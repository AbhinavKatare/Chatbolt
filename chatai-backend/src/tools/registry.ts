import { runWebSearch } from './web-search.tool'
import { runSendEmail } from './email.tool'
import { scrapeUrl } from './scraper.tool'
import { executeApiRequest } from './api-caller.tool'
import { processFile } from './file-processor.tool'

export interface ToolDefinition {
  name: string
  description: string
  inputs: string[]
  execute: (input: any) => Promise<any>
}

export const TOOLS: Record<string, ToolDefinition> = {
  web_search: {
    name: 'web_search',
    description: 'Search the web for real-time information',
    inputs: ['query: string'],
    execute: runWebSearch
  },
  send_email: {
    name: 'send_email',
    description: 'Send an email to a recipient',
    inputs: ['to: string', 'subject: string', 'body: string'],
    execute: runSendEmail
  },
  scraper: {
    name: 'scraper',
    description: 'Scrape content from a URL',
    inputs: ['url: string'],
    execute: scrapeUrl
  },
  api_caller: {
    name: 'api_caller',
    description: 'Make an HTTP request to an external API',
    inputs: ['method: string', 'url: string', 'headers?: object', 'body?: any'],
    execute: executeApiRequest
  },
  file_processor: {
    name: 'file_processor',
    description: 'Extract text and summarize files (PDF, DOCX, TXT)',
    inputs: ['filePath: string', 'operation: string'],
    execute: processFile
  }
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS[name]
}

export function listTools(): ToolDefinition[] {
  return Object.values(TOOLS)
}

export async function executeToolWithRetry(name: string, input: any, maxRetries = 3): Promise<any> {
  const tool = getTool(name)
  if (!tool) throw new Error(`Tool ${name} not found`)

  let lastError: any
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await tool.execute(input)
    } catch (err: any) {
      console.error(`Tool ${name} failed (Attempt ${i + 1}/${maxRetries}):`, err.message)
      lastError = err
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw lastError
}
