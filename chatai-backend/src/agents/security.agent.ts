import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'
import { readGitHubFile } from '../tools/github.tool'

export async function runSecurityAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting Security Audit (SAST/DAST)...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const { owner, repo, branch, file_path, github_token, code_snippet } = input.user_inputs
    
    let codeToAnalyze = code_snippet || ''

    // If a GitHub repo/file is provided, fetch the code
    if (owner && repo && file_path && !codeToAnalyze) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: `Fetching ${file_path} for security analysis...` })
      toolsUsed.push('github')
      const fileContent = await readGitHubFile({ owner, repo, path: file_path, branch, token: github_token })
      if (!fileContent.success) {
        throw new Error(`Failed to read file from GitHub: ${fileContent.error}`)
      }
      codeToAnalyze = fileContent.content
    }

    if (!codeToAnalyze) {
      throw new Error('No code provided for security analysis. Provide code_snippet or GitHub repo details.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Performing OWASP Top 10 vulnerability scan...' })
    
    const prompt = `You are a Principal Security Auditor and Ethical Hacker (White Hat).
Task: Perform a deep Static Application Security Testing (SAST) analysis on the following code.
Check for OWASP Top 10 vulnerabilities (SQLi, XSS, CSRF, Insecure Direct Object References, Hardcoded Secrets, etc.).

Code to analyze:
\`\`\`
${codeToAnalyze.substring(0, 20000)}
\`\`\`

Your output MUST be a JSON object with this structure:
{
  "vulnerability_score": "0-10",
  "findings": [
    {
      "severity": "High/Medium/Low",
      "type": "XSS, SQLi, etc.",
      "description": "Explanation of the vulnerability",
      "line_numbers": "Estimate or exact",
      "remediation": "How to fix it"
    }
  ],
  "patched_code": "Provide the fully patched and secured version of the code."
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Cybersecurity Expert.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'security_analysis', { length: generatedContent.length }, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse Security JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Completed security audit. Found ${(parsedData as any).findings?.length || 0} vulnerabilities.`,
      output_type: 'data',
      confidence,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output

  } catch (err: any) {
    console.error(`[Agent: ${agent.name}] Error:`, err.message)
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return {
      success: false,
      data: null,
      summary: 'Security audit failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
