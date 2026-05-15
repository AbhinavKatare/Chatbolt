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
  
  Return ONLY the code blocks.`

  const { content: code } = await callLLM('', 'You are an elite software engineer. Write clean, efficient, and well-documented code.', prompt)
  return { code }
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
