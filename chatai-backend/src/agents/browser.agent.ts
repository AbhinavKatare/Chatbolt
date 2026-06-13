import { logger } from '../services/logger.service';
import { callLLM, safeParseJSON } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { traceService } from '../services/trace.service'
import { queryOne } from '../db'
import { activeExtensions, pendingCommands, broadcastRunEvent } from '../services/socket.service'
import crypto from 'crypto'
import {
  navigate,
  clickElement,
  fillInput,
  captureScreenshot,
  parseDOM,
  closeBrowserSession
} from '../tools/browser.tool'

// Helper to route commands to Chrome Extension
async function runExtensionCommand(extSocket: any, action: string, payload: any = {}): Promise<any> {
  const commandId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(commandId)
      reject(new Error(`Extension command '${action}' timed out after 30s`))
    }, 30000)

    pendingCommands.set(commandId, {
      resolve: (val) => {
        clearTimeout(timeout)
        resolve(val)
      },
      reject: (err) => {
        clearTimeout(timeout)
        reject(err)
      }
    })

    extSocket.emit('browser:command', { commandId, action, ...payload })
  })
}

/**
 * Autonomous Browser Agent: Navigates websites, understands annotated DOM tree structures,
 * fills forms, clicks buttons, recovers from stuck states, and completes tasks autonomously.
 */
export async function runBrowserAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['browser']
  const actionLog: string[] = []
  
  logger.info(`[Agent: ${agent.name}] Starting autonomous browser session...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  const task = input.task || agent.description
  let currentUrl = 'about:blank'
  let consecutiveStuckCount = 0
  let lastStateFingerprint = ''

  let screenshotInterval: NodeJS.Timeout | null = null

  // Fetch tenantId for smart routing check
  let tenantId = ''
  try {
    const runRow = await queryOne<{ tenant_id: string }>('SELECT tenant_id FROM workflow_runs WHERE id = $1', [runId])
    tenantId = runRow?.tenant_id || ''
  } catch (err: any) {
    logger.warn(`[Browser Agent] Failed to fetch tenantId for run ${runId}:`, err.message)
  }

  const extSocket = tenantId ? activeExtensions.get(tenantId) : null
  const useRealBrowser = !!extSocket

  if (useRealBrowser) {
    logger.info(`[Agent: ${agent.name}] Chrome Extension connected! Routing browser actions to user's real browser session.`)
  } else {
    logger.info(`[Agent: ${agent.name}] Chrome Extension not connected. Falling back to sandboxed Playwright headless.`)
  }

  try {
    // 1. Initial page navigation setup
    if (useRealBrowser) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: 'Initializing Chrome Extension connection...' })
      await runExtensionCommand(extSocket, 'navigate', { url: 'https://www.google.com' })
    } else {
      runEmitter.emitEvent(runId, 'agent_progress', { message: 'Initializing sandboxed browser context...' })
      await navigate(runId, 'https://www.google.com')
    }
    actionLog.push('Initialized browser and navigated to google.com')

    // Start 3-second base64 screenshot stream
    screenshotInterval = setInterval(async () => {
      try {
        if (useRealBrowser) {
          const res = await runExtensionCommand(extSocket, 'screenshot')
          if (res && res.screenshot) {
            broadcastRunEvent(runId, 'browser:screenshot', {
              runId,
              screenshot: `data:image/png;base64,${res.screenshot}`,
              data: {
                screenshot: `data:image/png;base64,${res.screenshot}`
              }
            })
          }
        } else {
          const { getOrCreateBrowserSession } = await import('../tools/browser.tool')
          const { page } = await getOrCreateBrowserSession(runId)
          if (page && !page.isClosed()) {
            const buffer = await page.screenshot({ type: 'png', fullPage: false })
            const base64 = buffer.toString('base64')
            broadcastRunEvent(runId, 'browser:screenshot', {
              runId,
              screenshot: `data:image/png;base64,${base64}`,
              data: {
                screenshot: `data:image/png;base64,${base64}`
              }
            })
          }
        }
      } catch (err) {
        // Silent catch for closed contexts or speed races
      }
    }, 3000)
    
    // Recursive autonomous browsing loop (budgeted at max 8 steps to protect against loops/runaway bills)
    const MAX_BROWSER_STEPS = 8
    let finalFindings = ''
    let sources: string[] = []

    for (let step = 1; step <= MAX_BROWSER_STEPS; step++) {
      runEmitter.emitEvent(runId, 'agent_progress', { message: `Step ${step}/${MAX_BROWSER_STEPS}: Analyzing page DOM...` })

      // A. Extract Title, URL, and Compressed annotated DOM structure
      let domData: any
      if (useRealBrowser) {
        domData = await runExtensionCommand(extSocket, 'extract')
      } else {
        domData = await parseDOM(runId)
      }

      currentUrl = domData.url
      sources.push(currentUrl)

      // Take visual screenshot for observability
      let screenshotPath = ''
      try {
        if (useRealBrowser) {
          const res = await runExtensionCommand(extSocket, 'screenshot')
          screenshotPath = `data:image/png;base64,${res.screenshot}`
        } else {
          screenshotPath = await captureScreenshot(runId)
        }
        runEmitter.emitEvent(runId, 'agent_screenshot', {
          agent_id: agent.id,
          screenshot: screenshotPath,
          message: `Captured live screenshot of "${domData.title || currentUrl}"`
        })
      } catch (screnErr: any) {
        console.warn(`[Browser Agent] Failed to capture screenshot: ${screnErr.message}`)
      }

      // Stuck state detector
      const currentStateFingerprint = `${domData.url}::${domData.title}::${domData.interactiveElements.length}`
      if (currentStateFingerprint === lastStateFingerprint) {
        consecutiveStuckCount++
        logger.info(`[Browser Agent] Detect identical page state. Stuck count: ${consecutiveStuckCount}/3`)
      } else {
        consecutiveStuckCount = 0
      }
      lastStateFingerprint = currentStateFingerprint

      if (consecutiveStuckCount >= 3) {
        throw new Error(`Browser Agent got stuck on page "${domData.title}" (${domData.url}) after 3 repeating actions. Self-healing aborted to prevent loop.`)
      }

      // B. Present context to LLM to decide next step
      const systemPrompt = `You are Chatbolt's Autonomous Browser Operating Brain (Manus AI style).
Your mission is to perform actions on a live browser to fulfill the user's task.

User Task: "${task}"

Page Information:
- Current Title: "${domData.title}"
- Current URL: "${domData.url}"

Lightweight Compressed Interactive DOM (Choose elements by their numeric id like "21"):
${domData.compressedDOM.slice(0, 10000)}

Browser Action Log History:
${actionLog.length > 0 ? actionLog.map((l, i) => `${i + 1}. ${l}`).join('\n') : 'No actions taken yet'}

INSTRUCTIONS:
1. Review the Compressed DOM and identify the interactive elements that will move you closer to the task goal.
2. Select ONE next action to execute.
3. If you have found all required information or successfully completed the task, output "finish" and summarize the findings comprehensively.

Your response MUST be a single, valid JSON object matching exactly one of the following schemas:

A. To navigate to a new site:
{
  "action": "navigate",
  "url": "https://..."
}

B. To click an element (use the id from [tagName id=XX]):
{
  "action": "click",
  "selector": "XX"
}

C. To type/fill an input or textarea:
{
  "action": "fill",
  "selector": "XX",
  "text": "text content to type"
}

D. When the task is complete:
{
  "action": "finish",
  "findings": "A highly detailed, professional markdown report summarizing everything accomplished, retrieved data, or confirmation details.",
  "sources": ["https://..."]
}

Output ONLY valid JSON. Do not include markdown blocks, fences, or explanation.`

      runEmitter.emitEvent(runId, 'agent_progress', { message: `Step ${step}/${MAX_BROWSER_STEPS}: Deciding next action...` })
      
      const model = agent.config?.model || ''
      const { content: decisionRaw } = await callLLM(
        model,
        systemPrompt,
        `Task: "${task}"\nDecide next step.`,
        1500,
        1,
        runId,
        agent.name
      )

      let decision: any
      try {
        decision = safeParseJSON(decisionRaw)
      } catch (err: any) {
        console.warn(`[Browser Agent] Failed to parse action JSON: ${decisionRaw}`)
        if (step === MAX_BROWSER_STEPS) {
          decision = { action: 'finish', findings: 'Failed to parse final decision: ' + decisionRaw, sources }
        } else {
          throw new Error(`LLM generated invalid action format: ${err.message}`)
        }
      }

      logger.info(`[Browser Agent] Decision: ${JSON.stringify(decision)}`)

      if (decision.action === 'navigate') {
        const targetUrl = decision.url
        runEmitter.emitEvent(runId, 'agent_progress', { message: `Navigating to ${targetUrl}...` })
        if (useRealBrowser) {
          await runExtensionCommand(extSocket, 'navigate', { url: targetUrl })
        } else {
          await navigate(runId, targetUrl)
        }
        actionLog.push(`Navigated to ${targetUrl}`)
      } 
      else if (decision.action === 'click') {
        runEmitter.emitEvent(runId, 'agent_progress', { message: `Clicking element ID ${decision.selector}...` })
        if (useRealBrowser) {
          await runExtensionCommand(extSocket, 'click', { selector: decision.selector })
        } else {
          await clickElement(runId, decision.selector)
        }
        actionLog.push(`Clicked interactive element ID ${decision.selector}`)
      } 
      else if (decision.action === 'fill') {
        runEmitter.emitEvent(runId, 'agent_progress', { message: `Entering text into input ID ${decision.selector}...` })
        if (useRealBrowser) {
          await runExtensionCommand(extSocket, 'fill', { selector: decision.selector, text: decision.text })
        } else {
          await fillInput(runId, decision.selector, decision.text)
        }
        actionLog.push(`Filled input ID ${decision.selector} with "${decision.text}"`)
      } 
      else if (decision.action === 'finish') {
        finalFindings = decision.findings || 'Task completed.'
        if (decision.sources && Array.isArray(decision.sources)) {
          sources = [...sources, ...decision.sources]
        }
        actionLog.push('Browser execution marked as finished.')
        break
      } 
      else {
        throw new Error(`Unknown action type: "${decision.action}"`)
      }

      await new Promise(r => setTimeout(r, 1000))
    }

    if (!finalFindings) {
      finalFindings = `Reached maximum browser step budget of ${MAX_BROWSER_STEPS}. Action log:\n` + actionLog.map((l, i) => `${i+1}. ${l}`).join('\n')
    }

    // C. Compile Successful Output
    const cleanSources = Array.from(new Set(sources)).filter(s => s !== 'about:blank')
    const output: AgentOutput = {
      success: true,
      data: {
        results: finalFindings,
        action_log: actionLog,
        sources: cleanSources
      },
      summary: `Autonomous browsing session complete. Performed ${actionLog.length} actions across ${cleanSources.length} pages.`,
      output_type: 'text',
      confidence: 0.95,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }

    if (screenshotInterval) {
      clearInterval(screenshotInterval)
    }
    if (!useRealBrowser) {
      await closeBrowserSession(runId)
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output

  } catch (err: any) {
    console.error(`[Agent: ${agent.name}] Fatal browser exception:`, err.stack)
    
    if (screenshotInterval) {
      clearInterval(screenshotInterval)
    }
    if (!useRealBrowser) {
      await closeBrowserSession(runId)
    }

    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Autonomous browsing session failed',
      output_type: 'text',
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

