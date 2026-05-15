import fs from 'fs'
import pdf from 'pdf-parse'
// @ts-ignore
import mammoth from 'mammoth'
import { callLLM } from '../agents/base.agent'

export async function processFile({ filePath, operation }: { filePath: string, operation: 'extract' | 'summarize' }) {
  let text = ''
  const extension = filePath.split('.').pop()?.toLowerCase()

  if (extension === 'pdf') {
    const dataBuffer = fs.readFileSync(filePath)
    const data = await pdf(dataBuffer)
    text = data.text
  } else if (extension === 'docx') {
    const dataBuffer = fs.readFileSync(filePath)
    const result = await mammoth.extractRawText({ buffer: dataBuffer })
    text = result.value
  } else if (extension === 'txt' || extension === 'csv') {
    text = fs.readFileSync(filePath, 'utf8')
  } else {
    throw new Error(`Unsupported file type: ${extension}`)
  }

  if (operation === 'summarize') {
    const prompt = `Please summarize the following document. Extract key points and provide a concise overview.
    
    Document Content:
    ${text.slice(0, 15000)}`

    const { content: summary } = await callLLM('', 'You are an expert at document analysis and summarization.', prompt)
    return { summary, text: text.slice(0, 5000), wordCount: text.split(' ').length }
  }

  return { text: text.slice(0, 20000), wordCount: text.split(' ').length }
}

export async function searchInFiles({ directory, query }: { directory: string, query: string }) {
  const files = fs.readdirSync(directory)
  const results: { file: string, matches: string[] }[] = []

  for (const file of files) {
    const filePath = `${directory}/${file}`
    if (fs.lstatSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath, 'utf8')
      if (content.toLowerCase().includes(query.toLowerCase())) {
        const lines = content.split('\n')
        const matches = lines.filter(line => line.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
        results.push({ file, matches })
      }
    }
  }

  return results
}
