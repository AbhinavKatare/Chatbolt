import { callLLM } from '../agents/base.agent'
import { logger } from './logger.service'

export interface FormattedReport {
  title: string
  executive_summary: string
  table_of_contents: string[]
  sections: ReportSection[]
  citations: string[]
  word_count: number
  markdown: string
}

export interface ReportSection {
  heading: string
  content: string
  level: number // 1=H2, 2=H3
}

class ReportFormatterService {
  /**
   * Accepts raw markdown/text research output and restructures it into
   * a polished report with executive summary, TOC, citations, and sections.
   * Target: 800–1200 words.
   */
  async formatResearchReport(
    rawContent: string,
    title?: string,
    tenantId?: string
  ): Promise<FormattedReport> {
    logger.info('[Report Formatter] Formatting research report...')

    const systemPrompt = `You are a Professional Research Report Formatter.
Your job is to take raw research findings and transform them into a polished, structured, executive-grade report.

Rules:
- NEVER exceed 1200 words and NEVER go below 800 words in total content
- Always include an Executive Summary (2-3 sentences), Table of Contents, detailed sections, and citations if URLs are present
- Avoid jargon. Write in clear, professional English suitable for any business audience.
- Never use technical AI terms like "LLM", "agent", "pipeline", "token"
- In the content of your sections, add numbered inline markers like [1], [2] to reference the sources from the citations list.

Return ONLY valid JSON matching this structure:
{
  "title": "Professional title for the report",
  "executive_summary": "2-3 sentence summary of key findings",
  "table_of_contents": ["Section 1: ...", "Section 2: ..."],
  "sections": [
    {"heading": "Section name", "content": "400-600 chars of content", "level": 1}
  ],
  "citations": ["URL1 or source1", "URL2"]
}`

    const userMsg = `Raw research content to format:\n\n${rawContent.slice(0, 4000)}\n\nTitle hint: ${title || 'Research Report'}`

    try {
      const modelToUse = process.env.MISTRAL_API_KEY ? 'mistral-large-latest' : 'Qwen/WebWorld-8B:featherless-ai'
      const { content } = await callLLM(modelToUse, systemPrompt, userMsg, 2000)
      const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned) as Omit<FormattedReport, 'word_count' | 'markdown'>

      // Build full markdown document
      const mdParts = [
        `# ${parsed.title}`,
        ``,
        `## Executive Summary`,
        parsed.executive_summary,
        ``,
        `## Table of Contents`,
        parsed.table_of_contents.map((t, i) => `${i + 1}. ${t}`).join('\n'),
        ``,
        ...parsed.sections.flatMap(s => [
          `${'#'.repeat(s.level + 1)} ${s.heading}`,
          s.content,
          ``
        ])
      ]

      if (parsed.citations.length > 0) {
        mdParts.push('## Sources', parsed.citations.map((c, i) => `[${i + 1}] ${c}`).join('\n'))
      }

      const markdown = mdParts.join('\n')
      const word_count = markdown.split(/\s+/).length

      logger.info(`[Report Formatter] Report generated: ${word_count} words, ${parsed.sections.length} sections`)

      return { ...parsed, word_count, markdown }
    } catch (err: any) {
      logger.warn('[Report Formatter] LLM formatting failed, using basic structure: ' + err.message)

      // Fallback: basic markdown wrap
      const fallbackTitle = title || 'Research Report'
      const markdown = `# ${fallbackTitle}\n\n## Summary\n\n${rawContent.slice(0, 1200)}`
      return {
        title: fallbackTitle,
        executive_summary: rawContent.slice(0, 300),
        table_of_contents: ['Summary'],
        sections: [{ heading: 'Summary', content: rawContent.slice(0, 800), level: 1 }],
        citations: [],
        word_count: markdown.split(/\s+/).length,
        markdown
      }
    }
  }

  /**
   * Extracts and validates a word count — ensures minimum output quality threshold.
   */
  validateWordCount(markdown: string): { pass: boolean; word_count: number; reason?: string } {
    const word_count = markdown.split(/\s+/).filter(Boolean).length
    if (word_count < 100) {
      return { pass: false, word_count, reason: 'Output is too short. Please provide more detailed results.' }
    }
    return { pass: true, word_count }
  }
}

export const reportFormatterService = new ReportFormatterService()
