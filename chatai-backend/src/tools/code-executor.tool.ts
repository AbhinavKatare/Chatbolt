import { logger } from '../services/logger.service';
import { callLLM } from '../agents/base.agent'

export async function analyzeCode({ code, language }: { code: string, language: string }) {
  const prompt = `Analyze the following ${language} code for bugs, security vulnerabilities, and quality. Return a structured report in Markdown.
  
  Code:
  \`\`\`${language}
  ${code}
  \`\`\``

  const { content: report } = await callLLM('', 'You are an expert software architect and security auditor.', prompt)
  return { report }
}

export async function writeCode({ task, language, context }: { task: string, language: string, context?: string }) {
  const prompt = `Write high-quality, production-ready ${language} code for the following task:
  Task: ${task}
  ${context ? `Context: ${context}` : ''}
  
  Return ONLY the code blocks without markdown formatting if possible.`

  const { content: code } = await callLLM('', 'You are an elite software engineer. Write clean, efficient, and well-documented code.', prompt)
  return { code }
}

import { sandboxService } from '../services/sandbox.service'

/**
 * Sandboxed execution of Python code for Data Analysis pipelines.
 */
export async function executePython({ code }: { code: string }): Promise<{ stdout: string, stderr: string, success: boolean }> {
  // Strip markdown formatting if the LLM wrapped it in ```python ... ```
  let cleanCode = code
  if (cleanCode.startsWith('```')) {
    const lines = cleanCode.split('\n')
    if (lines[0].startsWith('```')) lines.shift()
    if (lines[lines.length - 1].startsWith('```')) lines.pop()
    cleanCode = lines.join('\n')
  }

  logger.info('[Code Executor Tool] Executing Python code inside micro-sandbox environment...')
  return sandboxService.runPython(cleanCode)
}

export async function debugCode({ code, error }: { code: string, error: string }) {
  const prompt = `Debug the following code which is producing this error:
  Error: ${error}
  
  Code:
  \`\`\`
  ${code}
  \`\`\`
  
  Identify the root cause, provide a fix, and explain the solution.`

  const { content: debugInfo } = await callLLM('', 'You are a master debugger. Analyze the error and code carefully.', prompt)
  return { debugInfo }
}

export async function writeTests({ code, framework }: { code: string, framework: string }) {
  const prompt = `Generate comprehensive unit tests using ${framework} for the following code. Include edge cases and happy paths.
  
  Code:
  \`\`\`
  ${code}
  \`\`\``

  const { content: tests } = await callLLM('', 'You are a QA expert specializing in test-driven development.', prompt)
  return { tests }
}
