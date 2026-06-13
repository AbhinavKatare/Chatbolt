import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { readGitHubFile, commitToGitHub, createPullRequest } from '../tools/github.tool'

export async function runCicdAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['github']
  
  logger.info(`[Agent: ${agent.name}] Starting self-healing CI/CD pipeline...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const { owner, repo, branch, error_log, file_path, github_token } = input.user_inputs
    
    if (!owner || !repo || !error_log || !file_path) {
      throw new Error('Missing required inputs: owner, repo, error_log, or file_path.')
    }
    
    // Step 1: Read the broken file
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Reading file ${file_path} from GitHub...` })
    const fileContent = await readGitHubFile({ owner, repo, path: file_path, branch, token: github_token })
    
    if (!fileContent.success) {
      throw new Error(`Failed to read file from GitHub: ${fileContent.error}`)
    }

    // Step 2: Ask the LLM to fix the code based on the CI error log
    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Analyzing build failure and writing fix...' })
    const prompt = `You are an elite DevOps & Software Engineering agent. 
A CI/CD build failed. 
File: ${file_path}
Error Log:
${error_log}

Current File Content:
\`\`\`
${fileContent.content}
\`\`\`

Write the full, fixed content for this file. 
Return ONLY the fixed code without markdown wrappers if possible.`

    const { content: fixedCode } = await callLLM(
      agent.config?.model || '',
      'You are a master debugger fixing broken CI/CD builds autonomously.',
      prompt,
      3000,
      1,
      runId,
      agent.name
    )
    
    let cleanCode = fixedCode
    if (cleanCode.startsWith('```')) {
      const lines = cleanCode.split('\n')
      if (lines[0].startsWith('```')) lines.shift()
      if (lines[lines.length - 1].startsWith('```')) lines.pop()
      cleanCode = lines.join('\n')
    }

    // Step 3: Commit the fix
    const fixBranchName = `chatbolt-auto-fix-${Date.now()}`
    runEmitter.emitEvent(runId, 'agent_progress', { message: `Committing fix to branch ${fixBranchName}...` })
    
    // In a real scenario, we'd create the branch first via GitHub API. 
    // Assuming the user token allows pushing directly or we simulate it here.
    const commitResult = await commitToGitHub({
      owner,
      repo,
      path: file_path,
      branch: branch, // Pushing directly to the branch for now, or you'd use fixBranchName
      content: cleanCode,
      message: 'fix: Auto-healing CI/CD build failure (Chatbolt OS)',
      token: github_token
    })

    if (!commitResult.success) {
      throw new Error(`Failed to commit fix: ${commitResult.error}`)
    }

    const output: AgentOutput = {
      success: true,
      data: {
        fixed_code: cleanCode,
        commit_url: commitResult.commitUrl
      },
      summary: `Successfully analyzed build failure and pushed a fix to ${file_path}.`,
      output_type: 'code',
      confidence: 0.95,
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
      summary: 'Self-healing failed',
      output_type: 'error',
      confidence: 0,
      error: err.message,
      metadata: { duration_ms: Date.now() - startTime, tokens_used: 0, tools_used: toolsUsed, retries: 0 }
    }
  }
}
