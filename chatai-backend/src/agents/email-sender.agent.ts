import { runBulkEmail } from '../tools/email.tool'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'

export async function runEmailSender(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['send_email']
  
  console.log(`[Agent: ${agent.name}] Starting email delivery...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const writerOutput = (Object.values(input.previous_outputs || {}) as any[]).find((o: any) => o.data?.content)?.data
    const content = writerOutput?.content || input.user_inputs?.email_body
    const subject = writerOutput?.subject_line || input.user_inputs?.email_subject || 'Notification'
    
    let recipients: string[] = []
    if (input.user_inputs?.recipients) {
      recipients = Array.isArray(input.user_inputs.recipients) 
        ? input.user_inputs.recipients 
        : input.user_inputs.recipients.split(',').map((s: string) => s.trim())
    }

    if (recipients.length === 0) {
      throw new Error('No recipients found for email delivery.')
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: `Sending emails to ${recipients.length} recipients...` })
    
    const results = await runBulkEmail({
      recipients,
      subject,
      html: content,
      smtpConfig: input.context?.smtp_config
    })

    const output: AgentOutput = {
      success: true,
      data: results,
      summary: `Email delivery complete. Sent: ${results.sent}, Failed: ${results.failed}.`,
      output_type: 'data',
      confidence: 1.0,
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
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Email delivery failed',
      output_type: 'data',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return errorOutput
  }
}
