import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'
import { readGitHubFile } from '../tools/github.tool'

export async function runSmartContractAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting Smart Contract Audit...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const { owner, repo, branch, file_path, github_token, contract_code } = input.user_inputs
    
    let codeToAnalyze = contract_code || ''

    if (owner && repo && file_path && !codeToAnalyze) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: `Fetching ${file_path} for Web3 security analysis...` })
      toolsUsed.push('github')
      const fileContent = await readGitHubFile({ owner, repo, path: file_path, branch, token: github_token })
      if (!fileContent.success) {
        throw new Error(`Failed to read file from GitHub: ${fileContent.error}`)
      }
      codeToAnalyze = fileContent.content
    }

    if (!codeToAnalyze) {
      throw new Error('No smart contract code provided for auditing.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Performing Web3 static analysis (Reentrancy, Logic flaws)...' })
    
    const prompt = `You are a Principal Web3 Security Auditor.
Task: Perform a deep static analysis on the following Solidity/Rust smart contract.
Check for common Web3 vulnerabilities (Reentrancy, Integer Overflow/Underflow, Front-running, Access Control flaws, Oracle Manipulation).

Contract Code:
\`\`\`
${codeToAnalyze.substring(0, 20000)}
\`\`\`

Your output MUST be a JSON object with this structure:
{
  "audit_status": "Secure/Vulnerable",
  "vulnerabilities": [
    {
      "severity": "Critical/High/Medium/Low",
      "type": "Reentrancy, Access Control, etc.",
      "description": "Explanation of the flaw",
      "exploit_scenario": "How an attacker could exploit this",
      "remediation": "How to fix it"
    }
  ],
  "patched_code": "Provide the fully patched and secured version of the contract."
}

Return ONLY valid JSON.`

    const toolStart = Date.now()
    const { content: generatedContent, confidence } = await callLLM(
      agent.config?.model || '',
      'You are a Web3 Cybersecurity Expert.',
      prompt,
      4000,
      1,
      runId,
      agent.name
    )

    await traceService.traceToolComplete(runId, agent.name, 'web3_analysis', { length: generatedContent.length }, Date.now() - toolStart)

    let parsedData = generatedContent
    try {
      parsedData = JSON.parse(generatedContent.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Failed to parse Web3 JSON', e)
    }

    const output: AgentOutput = {
      success: true,
      data: parsedData,
      summary: `Completed smart contract audit. Found ${(parsedData as any).vulnerabilities?.length || 0} vulnerabilities.`,
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
      summary: 'Smart Contract audit failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
