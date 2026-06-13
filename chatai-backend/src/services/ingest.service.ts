import { logger } from './logger.service';
import { query, queryOne } from '../db'
import { Document } from '../types'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { embedBatch as baseEmbedBatch } from '../agents/base.agent'

// ─── Text extraction ───────────────────────────────────────────────

async function extractFromPDF(filePath: string): Promise<string> {
  const pdfParse = await import('pdf-parse')
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse.default(buffer)
  return data.text
}

async function extractFromURL(url: string): Promise<string> {
  const { data: html } = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatAI-bot/1.0)' },
  })
  const cheerio = await import('cheerio')
  const $ = cheerio.load(html)

  // Remove noise elements
  $('script, style, nav, footer, header, aside, .cookie-banner, #cookie-banner').remove()

  // Extract meaningful text
  const text = $('body').text()
  return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

async function extractFromCSV(filePath: string): Promise<string> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length === 0) return ''

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
    return headers.map((h, i) => `${h}: ${values[i] || ''}`).join(', ')
  })

  return rows.join('\n')
}

// ─── Chunking ─────────────────────────────────────────────────────

function chunkText(text: string, chunkSize = 512, overlap = 64): string[] {
  if (!text || text.trim().length === 0) return []

  const chunks: string[] = []
  const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ' ']

  function split(text: string, separators: string[], size: number): string[] {
    if (text.length <= size) return [text]

    const sep = separators.find(s => text.includes(s)) || ''
    if (!sep) {
      // Force split at size
      const parts: string[] = []
      for (let i = 0; i < text.length; i += size - overlap) {
        parts.push(text.slice(i, i + size))
      }
      return parts
    }

    const parts = text.split(sep)
    const merged: string[] = []
    let current = ''

    for (const part of parts) {
      const candidate = current + (current ? sep : '') + part
      if (candidate.length <= size) {
        current = candidate
      } else {
        if (current) merged.push(current)
        current = part
      }
    }
    if (current) merged.push(current)
    return merged
  }

  const rawChunks = split(text, separators, chunkSize)

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i].trim()
    if (chunk.length < 20) continue // skip tiny fragments

    // Add overlap from previous chunk
    if (i > 0 && overlap > 0) {
      const prev = rawChunks[i - 1].trim()
      const overlapText = prev.slice(-overlap).trim()
      chunks.push(overlapText ? `${overlapText} ${chunk}` : chunk)
    } else {
      chunks.push(chunk)
    }
  }

  return chunks
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  return baseEmbedBatch(texts)
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ─── Main ingest function ─────────────────────────────────────────

export async function ingestDocument(documentId: string): Promise<void> {
  const doc = await queryOne<Document>(
    'SELECT * FROM documents WHERE id = $1',
    [documentId]
  )

  if (!doc) throw new Error(`Document ${documentId} not found`)

  // Mark as processing
  await query(
    "UPDATE documents SET status = 'processing', updated_at = NOW() WHERE id = $1",
    [documentId]
  )

  try {
    // 1. Extract text
    let rawText = ''
    if (doc.source_type === 'pdf' && doc.file_path) {
      rawText = await extractFromPDF(doc.file_path)
    } else if (doc.source_type === 'url' && doc.source_url) {
      rawText = await extractFromURL(doc.source_url)
    } else if (doc.source_type === 'text' && doc.file_path) {
      rawText = fs.readFileSync(doc.file_path, 'utf-8')
    } else if (doc.source_type === 'csv' && doc.file_path) {
      rawText = await extractFromCSV(doc.file_path)
    }

    if (!rawText || rawText.trim().length < 10) {
      throw new Error('Could not extract text from document')
    }

    // 2. Chunk
    const chunks = chunkText(rawText, 512, 64)
    if (chunks.length === 0) throw new Error('No chunks generated')

    // 3. Delete existing chunks for this doc (re-ingest case)
    await query('DELETE FROM chunks WHERE document_id = $1', [documentId])

    // 4. Embed + store in batches of 100
    const batches = chunkArray(chunks, 100)
    let totalStored = 0

    for (const batch of batches) {
      const embeddings = await embedBatch(batch)

      // Bulk insert
      for (let i = 0; i < batch.length; i++) {
        await query(
          `INSERT INTO chunks (document_id, agent_id, tenant_id, content, embedding, chunk_index, metadata)
           VALUES ($1, $2, $3, $4, $5::vector, $6, $7)`,
          [
            doc.id,
            doc.agent_id,
            doc.tenant_id,
            batch[i],
            `[${embeddings[i].join(',')}]`,
            totalStored + i,
            JSON.stringify({ source: doc.filename, source_type: doc.source_type }),
          ]
        )
      }
      totalStored += batch.length
    }

    // 5. Mark ready
    await query(
      "UPDATE documents SET status = 'ready', chunk_count = $1, updated_at = NOW() WHERE id = $2",
      [totalStored, documentId]
    )

    logger.info(`✅ Ingested ${doc.filename}: ${totalStored} chunks`)
  } catch (err: any) {
    await query(
      "UPDATE documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2",
      [err.message, documentId]
    )
    throw err
  }
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await query('DELETE FROM chunks WHERE document_id = $1', [documentId])
}
