import { logger } from './logger.service'

export interface ProgressiveDisclosureResult {
  isTruncated: boolean
  totalBytes: number
  totalLines: number
  contentForModel: string
  contentRef?: string
  previewLines: number
  summary?: string
}

export interface ChunkInspectionResult {
  contentRef: string
  offset: number
  limit: number
  totalLines: number
  lines: string[]
  content: string
  hasMore: boolean
}

export class ProgressiveToolDisclosureService {
  private contentStore: Map<string, { content: string; createdAt: number; toolName: string }> = new Map()
  private MAX_TOOL_BYTES = 1500
  private MAX_TOOL_LINES = 30
  private TTL_MS = 60 * 60 * 1000 // 1 hour

  /**
   * Sanitizes and progressively truncates large tool outputs before entering agent working context
   */
  processToolOutput(
    rawOutput: any,
    toolName = 'tool',
    maxBytes = this.MAX_TOOL_BYTES,
    maxLines = this.MAX_TOOL_LINES
  ): ProgressiveDisclosureResult {
    if (rawOutput === null || rawOutput === undefined) {
      return {
        isTruncated: false,
        totalBytes: 0,
        totalLines: 0,
        contentForModel: '',
        previewLines: 0
      }
    }

    const strContent = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput, null, 2)
    const totalBytes = Buffer.byteLength(strContent, 'utf8')
    const lines = strContent.split('\n')
    const totalLines = lines.length

    // If within limits, pass through unchanged
    if (totalBytes <= maxBytes && totalLines <= maxLines) {
      return {
        isTruncated: false,
        totalBytes,
        totalLines,
        contentForModel: strContent,
        previewLines: totalLines
      }
    }

    // Generate handle reference and store full payload
    const contentRef = `ref_tool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    this.cleanupExpired()
    this.contentStore.set(contentRef, {
      content: strContent,
      createdAt: Date.now(),
      toolName
    })

    const preview = lines.slice(0, maxLines).join('\n')
    const remainingLines = totalLines - maxLines

    const contentForModel = [
      `⚠️ [Tool Output Summarized: ${totalLines} lines, ${totalBytes} bytes from '${toolName}']`,
      `Showing preview (${maxLines} lines). To view additional lines, call 'inspect_tool_output_chunk' with content_ref: '${contentRef}'`,
      ``,
      preview,
      ``,
      `... [${remainingLines} lines omitted. Total: ${totalLines} lines (${(totalBytes / 1024).toFixed(1)} KB)]`
    ].join('\n')

    logger.info(`[ProgressiveDisclosure] Summarized tool '${toolName}': ${totalBytes}B -> ${contentForModel.length} chars (Ref: ${contentRef})`)

    return {
      isTruncated: true,
      totalBytes,
      totalLines,
      contentForModel,
      contentRef,
      previewLines: maxLines,
      summary: `Tool output from '${toolName}' truncated from ${totalLines} lines to ${maxLines} preview lines.`
    }
  }

  /**
   * Retrieves a paginated slice of stored tool output for follow-up inspection
   */
  fetchChunk(contentRef: string, offset = 0, limit = 50): ChunkInspectionResult {
    const entry = this.contentStore.get(contentRef)
    if (!entry) {
      throw new Error(`Tool output reference '${contentRef}' not found or has expired.`)
    }

    const lines = entry.content.split('\n')
    const totalLines = lines.length
    const startIdx = Math.max(0, offset)
    const endIdx = Math.min(totalLines, startIdx + limit)
    const slice = lines.slice(startIdx, endIdx)

    return {
      contentRef,
      offset: startIdx,
      limit,
      totalLines,
      lines: slice,
      content: slice.join('\n'),
      hasMore: endIdx < totalLines
    }
  }

  private cleanupExpired() {
    const now = Date.now()
    for (const [key, val] of this.contentStore.entries()) {
      if (now - val.createdAt > this.TTL_MS) {
        this.contentStore.delete(key)
      }
    }
  }
}

export const progressiveToolDisclosureService = new ProgressiveToolDisclosureService()
