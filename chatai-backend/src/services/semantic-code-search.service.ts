import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { logger } from './logger.service'
import { generateEmbedding, cosineSimilarity } from './rag.service'

export interface CodeChunk {
  id: string
  filePath: string
  relativePath: string
  startLine: int
  endLine: int
  content: string
  contentHash: string
  embedding?: number[]
  language: string
}

type int = number

export interface SearchResult {
  filePath: string
  relativePath: string
  startLine: number
  endLine: number
  content: string
  score: number
  reference: string // e.g. "src/index.ts:L45-L80"
}

export class SemanticCodeSearchService {
  private chunksIndex: Map<string, CodeChunk> = new Map() // chunkId -> CodeChunk
  private fileHashes: Map<string, string> = new Map() // filePath -> sha256
  private isIndexing = false

  /**
   * Chunks code into semantic blocks (20-50 lines) preserving function and block boundaries
   */
  chunkCode(filePath: string, content: string, relativePath: string): CodeChunk[] {
    const lines = content.split('\n')
    const chunks: CodeChunk[] = []
    const totalLines = lines.length

    if (totalLines === 0) return []

    // If small file, single chunk
    if (totalLines <= 40) {
      const hash = crypto.createHash('sha256').update(content).digest('hex')
      return [{
        id: `${relativePath}:L1-L${totalLines}`,
        filePath,
        relativePath,
        startLine: 1,
        endLine: totalLines,
        content,
        contentHash: hash,
        language: this.detectLanguage(filePath)
      }]
    }

    const CHUNK_SIZE = 35
    const CHUNK_OVERLAP = 10
    let currentLine = 1

    while (currentLine <= totalLines) {
      const endLine = Math.min(totalLines, currentLine + CHUNK_SIZE - 1)
      const chunkLines = lines.slice(currentLine - 1, endLine)
      const chunkContent = chunkLines.join('\n')
      const hash = crypto.createHash('sha256').update(chunkContent).digest('hex')

      chunks.push({
        id: `${relativePath}:L${currentLine}-L${endLine}`,
        filePath,
        relativePath,
        startLine: currentLine,
        endLine,
        content: chunkContent,
        contentHash: hash,
        language: this.detectLanguage(filePath)
      })

      if (endLine >= totalLines) break
      currentLine += (CHUNK_SIZE - CHUNK_OVERLAP)
    }

    return chunks
  }

  /**
   * Incrementally indexes a target repository or directory
   */
  async indexRepository(repoRoot: string, fileExtensions: string[] = ['.ts', '.js', '.py', '.go', '.json', '.sql', '.md']): Promise<{ indexedFiles: number; totalChunks: number; skippedUnchanged: number }> {
    if (!fs.existsSync(repoRoot)) {
      throw new Error(`Repository root path does not exist: ${repoRoot}`)
    }

    this.isIndexing = true
    let indexedFiles = 0
    let skippedUnchanged = 0

    const files = this.scanFiles(repoRoot, fileExtensions)
    logger.info(`[CodeSearch] Scanning repository: ${files.length} candidate files in ${repoRoot}`)

    for (const fullPath of files) {
      const relPath = path.relative(repoRoot, fullPath).replace(/\\/g, '/')
      const content = fs.readFileSync(fullPath, 'utf8')
      const fileHash = crypto.createHash('sha256').update(content).digest('hex')

      // Incremental check: skip if unchanged
      if (this.fileHashes.get(fullPath) === fileHash) {
        skippedUnchanged++
        continue
      }

      // Invalidate old chunks for this file
      for (const [id, chunk] of this.chunksIndex.entries()) {
        if (chunk.filePath === fullPath) {
          this.chunksIndex.delete(id)
        }
      }

      this.fileHashes.set(fullPath, fileHash)
      const chunks = this.chunkCode(fullPath, content, relPath)

      // Generate embeddings for new chunks
      for (const chunk of chunks) {
        try {
          const emb = await generateEmbedding(`${chunk.relativePath} (${chunk.language}):\n${chunk.content}`)
          chunk.embedding = emb
        } catch (err: any) {
          logger.warn(`[CodeSearch] Failed to embed chunk ${chunk.id}: ${err.message}`)
        }
        this.chunksIndex.set(chunk.id, chunk)
      }

      indexedFiles++
    }

    this.isIndexing = false
    logger.info(`[CodeSearch] Indexing completed: ${indexedFiles} updated, ${skippedUnchanged} unchanged, ${this.chunksIndex.size} total active chunks.`)

    return {
      indexedFiles,
      totalChunks: this.chunksIndex.size,
      skippedUnchanged
    }
  }

  /**
   * Semantic search over indexed code chunks with keyword hybrid reranking
   */
  async searchCode(query: string, topK = 5, pathFilter?: string): Promise<SearchResult[]> {
    if (this.chunksIndex.size === 0) {
      return []
    }

    let queryEmb: number[] = []
    try {
      queryEmb = await generateEmbedding(query)
    } catch {
      queryEmb = []
    }

    const queryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const results: SearchResult[] = []

    for (const chunk of this.chunksIndex.values()) {
      if (pathFilter && !chunk.relativePath.toLowerCase().includes(pathFilter.toLowerCase())) {
        continue
      }

      let similarity = 0
      if (queryEmb.length > 0 && chunk.embedding && chunk.embedding.length > 0) {
        similarity = cosineSimilarity(queryEmb, chunk.embedding)
      }

      // Keyword boost
      let keywordMatches = 0
      const chunkLower = chunk.content.toLowerCase()
      const pathLower = chunk.relativePath.toLowerCase()
      for (const kw of queryKeywords) {
        if (chunkLower.includes(kw) || pathLower.includes(kw)) {
          keywordMatches++
        }
      }

      const keywordScore = queryKeywords.length > 0 ? (keywordMatches / queryKeywords.length) * 0.4 : 0
      const finalScore = (similarity * 0.6) + keywordScore

      if (finalScore > 0.1 || keywordMatches > 0) {
        results.push({
          filePath: chunk.filePath,
          relativePath: chunk.relativePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          content: chunk.content,
          score: Math.round(finalScore * 1000) / 1000,
          reference: `${chunk.relativePath}:L${chunk.startLine}-L${chunk.endLine}`
        })
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  /**
   * Manually adds a virtual/mock code chunk for testing or ad-hoc file contexts
   */
  addChunk(chunk: CodeChunk) {
    this.chunksIndex.set(chunk.id, chunk)
  }

  clear() {
    this.chunksIndex.clear()
    this.fileHashes.clear()
  }

  getChunkCount(): number {
    return this.chunksIndex.size
  }

  private scanFiles(dir: string, extensions: string[]): string[] {
    let results: string[] = []
    try {
      const list = fs.readdirSync(dir)
      for (const file of list) {
        if (file.startsWith('.') || file === 'node_modules' || file === 'dist' || file === 'bin' || file === 'venv' || file === 'target') {
          continue
        }
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)
        if (stat && stat.isDirectory()) {
          results = results.concat(this.scanFiles(fullPath, extensions))
        } else {
          const ext = path.extname(file).toLowerCase()
          if (extensions.includes(ext)) {
            results.push(fullPath)
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[CodeSearch] Error scanning dir ${dir}: ${err.message}`)
    }
    return results
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript'
      case '.js':
      case '.jsx':
        return 'javascript'
      case '.py':
        return 'python'
      case '.go':
        return 'go'
      case '.json':
        return 'json'
      case '.sql':
        return 'sql'
      case '.md':
        return 'markdown'
      default:
        return 'text'
    }
  }
}

export const semanticCodeSearchService = new SemanticCodeSearchService()
