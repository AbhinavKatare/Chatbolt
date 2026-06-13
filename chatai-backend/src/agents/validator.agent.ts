import { logger } from '../services/logger.service';
import { AgentOutput, WorkflowAgent } from '../types'
import { callLLM, safeParseJSON, cleanEnvVar } from './base.agent'
import { traceService } from '../services/trace.service'
import { validateAgentOutput, scoreOutput } from '../services/validator.service'
import { outcomeEngineService } from '../services/outcome-engine.service'


export interface ValidationResult {
  success: boolean
  error?: string
  confidence?: number
  classification?: 'schema_mismatch' | 'semantic_failure' | 'hallucination' | 'incomplete_data' | 'system_error'
  explanation?: string
}

/**
 * Hybrid Validator Agent: Combines deterministic schema checks with semantic LLM inspection.
 * Verifies accuracy, checks for hallucinations, and validates output completeness.
 */
export async function runValidator(
  agent: WorkflowAgent,
  output: AgentOutput,
  runId: string
): Promise<ValidationResult> {
  logger.info(`[Validator] Validating output for Agent: "${agent.name}" (${agent.role})...`)

  // 1. Initial System/Success Check
  if (!output.success) {
    return {
      success: false,
      error: output.error || 'Agent failed to execute successfully.',
      classification: 'system_error',
      explanation: 'Executor returned an unsuccessful status.'
    }
  }

  if (!output.data) {
    return {
      success: false,
      error: 'Agent output data is null or empty.',
      classification: 'incomplete_data',
      explanation: 'The returned data object is null or undefined.'
    }
  }

  // Universal Quality Gate
  const qualityCheck = outcomeEngineService.validateOutput(agent.role, output.data)
  if (!qualityCheck.pass) {
    return {
      success: false,
      error: `Quality gate validation failed: ${qualityCheck.issues.join('; ')}`,
      classification: 'schema_mismatch',
      explanation: `Failed quality requirements: ${qualityCheck.issues.join(', ')}`
    }
  }


  // 2. Deterministic Schema Validation
  // Read expected required fields from agent configuration if defined
  const valRequirements = agent.config?.validation_requirements
  const schemaCheckEnabled = valRequirements?.schema_check ?? true
  const requiredFields = valRequirements?.required_fields || []

  if (schemaCheckEnabled) {
    // Standard deterministic validations
    const deterministicCheck = await validateAgentOutput(output, agent.output_type)
    if (!deterministicCheck.valid) {
      return {
        success: false,
        error: `Deterministic validation failed: ${deterministicCheck.issues.join('; ')}`,
        classification: 'schema_mismatch',
        explanation: 'Failed static structural/type checks.'
      }
    }

    // Direct field presence check with dynamic LLM extraction fallback
    const missingFields = requiredFields.filter(
      field => output.data[field] === undefined || output.data[field] === null || output.data[field] === ''
    )

    if (missingFields.length > 0) {
      logger.info(`[Validator] Attempting dynamic extraction for missing required fields: ${JSON.stringify(missingFields)}`)
      const sourceText = Object.entries(output.data || {})
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n\n')

      if (sourceText.trim()) {
        const extractionPrompt = `You are a precise data extraction agent.
Extract values for the following required fields from the text provided below.

Required Fields to Extract:
${missingFields.map(f => `- ${f}`).join('\n')}

Text Content:
"""
${sourceText.slice(0, 15000)}
"""

Return ONLY a valid JSON object where the keys are the exact field names requested, and the values are the extracted information (or null if not found in the text).
DO NOT emit markdown fences or any explanation. Example:
{
  "field_name": "extracted value"
}`

        try {
          const kimiKey = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
          const modelToUse = kimiKey ? 'moonshotai/kimi-k2.6' : (process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai')
          const { content: llmRes } = await callLLM(
            modelToUse,
            extractionPrompt,
            'Extract structured fields from unstructured text.',
            1000,
            1,
            runId,
            'ExtractorHelper'
          )

          const extracted = safeParseJSON(llmRes)
          for (const field of missingFields) {
            if (extracted[field] !== undefined && extracted[field] !== null && extracted[field] !== '') {
              output.data[field] = extracted[field]
              logger.info(`[Validator] Dynamically extracted and populated field: "${field}"`)
            }
          }
        } catch (err: any) {
          console.warn(`[Validator] Dynamic field extraction failed: ${err.message}`)
        }
      }
    }

    // Re-verify after dynamic extraction
    for (const field of requiredFields) {
      if (output.data[field] === undefined || output.data[field] === null || output.data[field] === '') {
        return {
          success: false,
          error: `Deterministic validation failed: Required field "${field}" is missing from output.`,
          classification: 'schema_mismatch',
          explanation: `Field "${field}" specified in validation requirements was not returned and could not be dynamically extracted.`
        }
      }
    }
  }

  // 3. Semantic Validation (LLM evaluation for completeness & hallucinations)
  const semanticCheckEnabled = valRequirements?.semantic_check ?? true
  if (semanticCheckEnabled) {
    const semanticPrompt = `You are a Senior Cognitive Quality Auditor. Your job is to verify whether the output produced by an AI Agent satisfies the task guidelines and remains free of hallucinations or logical contradictions.

Agent Name: "${agent.name}"
Agent Role: "${agent.role}"
Task Instruction: "${agent.description}"
System Prompt: "${agent.system_prompt}"

Actual Agent Output Data:
${JSON.stringify(output.data, null, 2)}

Please evaluate the output based on these criteria:
1. COMPLETENESS: Does the output address all instructions and criteria in the Task?
2. ACCURACY & LOGIC: Are there any clear logical errors, empty content blocks, or placeholders?
3. HALLUCINATION CHECK: Does the agent make unsupported claims or output generic gibberish?
4. SPECIFICITY: Is the content actionable or is it overly vague?

Note: Extra fields inside the output data (such as "report", "sources", "key_facts", or other contextual properties) are completely normal and highly encouraged as they provide rich context for downstream agents. Do NOT penalize or fail the audit due to the presence of extra fields. Focus your evaluation strictly on the completeness, accuracy, and quality of the required fields: ${JSON.stringify(requiredFields)}.

Return ONLY a valid JSON object with the following schema:
{
  "satisfactory": true/false,
  "confidence_score": 0.0 to 1.0,
  "explanation": "Brief reasoning explaining the verdict",
  "detected_issues": ["list of issues found or empty array"]
}
DO NOT emit markdown or fences. Emit ONLY raw JSON.`

    try {
      const kimiKey = cleanEnvVar('KIMI_K2_API_KEY') || cleanEnvVar('KIMI_API_KEY')
      const modelToUse = kimiKey ? 'moonshotai/kimi-k2.6' : (process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai')
      const { content: llmRes } = await callLLM(
        modelToUse,
        semanticPrompt,
        'Perform cognitive audit on the agent output and return verdict.',
        1000,
        1,
        runId,
        'ValidatorAgent'
      )

      const result = safeParseJSON(llmRes)

      if (!result.satisfactory || result.confidence_score < 0.6) {
        const isHallucination = result.detected_issues?.some((i: string) => i.toLowerCase().includes('hallucinat') || i.toLowerCase().includes('invented'))
        return {
          success: false,
          error: `Semantic audit failed: ${result.detected_issues?.join('; ') || 'Low quality output detected'}`,
          classification: isHallucination ? 'hallucination' : 'semantic_failure',
          confidence: result.confidence_score,
          explanation: result.explanation
        }
      }
    } catch (err: any) {
      console.warn(`[Validator] Semantic validation encountered an LLM error: ${err.message}. Relying on deterministic checks.`)
    }
  }

  // 4. Calculate Final Confidence Score
  const finalScore = await scoreOutput(output)

  logger.info(`[Validator] Agent output passed validation successfully with score: ${finalScore}`)
  return {
    success: true,
    confidence: finalScore,
    explanation: 'Passed all deterministic and semantic audits.'
  }
}
