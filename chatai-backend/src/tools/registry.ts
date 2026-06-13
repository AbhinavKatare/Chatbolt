import { logger } from '../services/logger.service';
import { runWebSearch } from './web-search.tool'
import { runSendEmail } from './email.tool'
import { scrapeUrl } from './scraper.tool'
import { executeApiRequest } from './api-caller.tool'
import { processFile } from './file-processor.tool'
import { traceService } from '../services/trace.service'
import { navigate, clickElement, fillInput, captureScreenshot, parseDOM } from './browser.tool'

export interface ToolDefinition {
  name: string
  description: string
  inputs: string[]
  execute: (input: any, runId?: string) => Promise<any>
}

// Global list of destructive/outbound tools
const DESTRUCTIVE_TOOLS = ['send_email', 'api_caller']

export const TOOLS: Record<string, ToolDefinition> = {
  web_search: {
    name: 'web_search',
    description: 'Search the web for real-time information',
    inputs: ['query: string'],
    execute: async (input, runId) => {
      return runWebSearch(input)
    }
  },
  send_email: {
    name: 'send_email',
    description: 'Send an email to a recipient',
    inputs: ['to: string', 'subject: string', 'body: string'],
    execute: async (input, runId) => {
      if (process.env.DRY_RUN === 'true' || input?.dryRun === true) {
        logger.info(`[Registry] [DRY RUN] Intercepted send_email to ${input?.to}`)
        return { messageId: `mock-msg-${Date.now()}`, accepted: [input?.to || 'test@example.com'], rejected: [], dryRun: true }
      }
      return runSendEmail(input)
    }
  },
  scraper: {
    name: 'scraper',
    description: 'Scrape content from a URL',
    inputs: ['url: string'],
    execute: async (input, runId) => {
      return scrapeUrl(input)
    }
  },
  api_caller: {
    name: 'api_caller',
    description: 'Make an HTTP request to an external API',
    inputs: ['method: string', 'url: string', 'headers?: object', 'body?: any'],
    execute: async (input, runId) => {
      const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes((input?.method || '').toUpperCase())
      if (isMutating && (process.env.DRY_RUN === 'true' || input?.dryRun === true)) {
        logger.info(`[Registry] [DRY RUN] Intercepted destructive api_caller: ${input?.method} ${input?.url}`)
        return { success: true, message: 'Dry run request bypassed', data: null, dryRun: true }
      }
      return executeApiRequest(input)
    }
  },
  file_processor: {
    name: 'file_processor',
    description: 'Extract text and summarize files (PDF, DOCX, TXT)',
    inputs: ['filePath: string', 'operation: string'],
    execute: async (input, runId) => {
      return processFile(input)
    }
  },
  browser: {
    name: 'browser',
    description: 'Autonomous browser tool to interact with websites. Actions: navigate, click, fill, screenshot, parse',
    inputs: ['action: string', 'url?: string', 'selector?: string', 'text?: string'],
    execute: async (input, runId) => {
      if (!runId) {
        throw new Error('runId is required to execute browser actions')
      }
      const action = input.action
      
      // Event Sourcing Log
      await traceService.logTrace(runId, 'BROWSER_ACTION_EXECUTED', {
        toolName: 'browser',
        action,
        url: input.url || '',
        selector: input.selector || '',
        message: `Browser action executed: ${action}`
      })

      if (action === 'navigate') {
        return navigate(runId, input.url)
      } else if (action === 'click') {
        await clickElement(runId, input.selector)
        return { success: true }
      } else if (action === 'fill') {
        await fillInput(runId, input.selector, input.text)
        return { success: true }
      } else if (action === 'screenshot') {
        const screenshotPath = await captureScreenshot(runId)
        return { screenshotPath }
      } else if (action === 'parse') {
        return parseDOM(runId)
      } else {
        throw new Error(`Unknown browser action: ${action}`)
      }
    }
  }
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS[name]
}

export function listTools(): ToolDefinition[] {
  return Object.values(TOOLS)
}

export async function executeToolWithRetry(name: string, input: any, maxRetries = 3, runId?: string): Promise<any> {
  const tool = getTool(name)
  if (!tool) throw new Error(`Tool ${name} not found`)

  const isDestructive = DESTRUCTIVE_TOOLS.includes(name)
  const isDryRun = process.env.DRY_RUN === 'true' || input?.dryRun === true

  if (isDestructive && isDryRun) {
    logger.info(`[Registry] Bypassing execution of destructive tool "${name}" under dryRun configuration.`)
    if (runId) {
      await traceService.logTrace(runId, 'TOOL_EXECUTED', {
        toolName: name,
        toolParams: input,
        message: `Destructive tool "${name}" execution bypassed (Dry Run Mode).`
      })
    }
    // Return mock output
    if (name === 'send_email') {
      return { messageId: `mock-msg-${Date.now()}`, accepted: [input?.to || 'test@example.com'], rejected: [], dryRun: true }
    }
    return { success: true, message: 'Bypassed under dryRun', dryRun: true }
  }

  let lastError: any
  const startTime = Date.now()

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (runId) {
        await traceService.traceToolStart(runId, 'System', name, input)
      }
      
      const result = await tool.execute(input, runId)
      
      const duration = Date.now() - startTime
      if (runId) {
        await traceService.traceToolComplete(runId, 'System', name, result, duration)
      }
      
      return result
    } catch (err: any) {
      const duration = Date.now() - startTime
      console.error(`Tool ${name} failed (Attempt ${i + 1}/${maxRetries}):`, err.message)
      lastError = err
      
      if (runId) {
        await traceService.traceToolComplete(runId, 'System', name, null, duration, err.message)
      }

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }
  throw lastError
}

