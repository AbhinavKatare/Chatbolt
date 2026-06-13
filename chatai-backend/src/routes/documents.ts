import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db'
import { authMiddleware } from '../middleware/auth.middleware'
import { ingestDocument, deleteDocumentChunks } from '../services/ingest.service'
import { Document } from '../types'

const router = Router()

// Multer config
const uploadDir = process.env.UPLOAD_DIR || './uploads'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_, file, cb) => cb(null, `${uuidv4()}-${file.originalname.replace(/\s+/g, '_')}`),
})

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // Enforce 25MB limit
  fileFilter: (_, file, cb) => {
    const allowed = ['.pdf', '.txt', '.csv', '.docx', '.md']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error(`File type ${ext} not allowed. Use: ${allowed.join(', ')}`))
  },
})

function uploadMiddleware(req: Request, res: Response, next: any) {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds the 25MB limit. Please upload a smaller file.' })
      }
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}

// Verify agent belongs to tenant
async function getAgentForTenant(agentId: string, tenantId: string) {
  return queryOne('SELECT id FROM agents WHERE id = $1 AND tenant_id = $2 AND is_active = true', [agentId, tenantId])
}

// GET /agents/:agentId/documents
router.get('/:agentId/documents', authMiddleware, async (req: Request, res: Response) => {
  const agent = await getAgentForTenant(req.params.agentId, req.tenantId!)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const docs = await query<Document>(
    `SELECT id, filename, source_type, source_url, status, error_message, chunk_count, file_size, created_at
     FROM documents WHERE agent_id = $1 ORDER BY created_at DESC`,
    [req.params.agentId]
  )
  res.json({ documents: docs })
})

// POST /agents/:agentId/documents/upload
router.post('/:agentId/documents/upload', authMiddleware, uploadMiddleware, async (req: Request, res: Response) => {
  try {
    const agent = await getAgentForTenant(req.params.agentId, req.tenantId!)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const ext = path.extname(req.file.originalname).toLowerCase().slice(1)
    const sourceType = ext === 'txt' || ext === 'md' ? 'text' : ext as any

    const [doc] = await query<Document>(
      `INSERT INTO documents (agent_id, tenant_id, filename, source_type, file_path, file_size, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [req.params.agentId, req.tenantId, req.file.originalname, sourceType, req.file.path, req.file.size]
    )

    // Run ingest async (don't await — respond immediately)
    ingestDocument(doc.id).catch(err => console.error('Ingest error:', err))

    res.status(201).json({ document: doc, message: 'File uploaded. Processing started.' })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /agents/:agentId/documents/url
router.post('/:agentId/documents/url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const agent = await getAgentForTenant(req.params.agentId, req.tenantId!)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const { url } = z.object({ url: z.string().url() }).parse(req.body)

    const hostname = new URL(url).hostname
    const [doc] = await query<Document>(
      `INSERT INTO documents (agent_id, tenant_id, filename, source_type, source_url, status)
       VALUES ($1, $2, $3, 'url', $4, 'pending') RETURNING *`,
      [req.params.agentId, req.tenantId, `Web: ${hostname}`, url]
    )

    ingestDocument(doc.id).catch(err => console.error('Ingest error:', err))
    res.status(201).json({ document: doc, message: 'URL queued for scraping.' })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid URL' })
    res.status(400).json({ error: err.message })
  }
})

// POST /agents/:agentId/documents/text
router.post('/:agentId/documents/text', authMiddleware, async (req: Request, res: Response) => {
  try {
    const agent = await getAgentForTenant(req.params.agentId, req.tenantId!)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const { content, name } = z.object({
      content: z.string().min(20),
      name: z.string().min(1),
    }).parse(req.body)

    // Save to temp file
    const filePath = path.join(uploadDir, `${uuidv4()}.txt`)
    fs.writeFileSync(filePath, content)

    const [doc] = await query<Document>(
      `INSERT INTO documents (agent_id, tenant_id, filename, source_type, file_path, status)
       VALUES ($1, $2, $3, 'text', $4, 'pending') RETURNING *`,
      [req.params.agentId, req.tenantId, name, filePath]
    )

    ingestDocument(doc.id).catch(err => console.error('Ingest error:', err))
    res.status(201).json({ document: doc })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// POST /agents/:agentId/documents/:docId/reingest
router.post('/:agentId/documents/:docId/reingest', authMiddleware, async (req: Request, res: Response) => {
  const agent = await getAgentForTenant(req.params.agentId, req.tenantId!)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const doc = await queryOne<Document>(
    'SELECT * FROM documents WHERE id = $1 AND agent_id = $2',
    [req.params.docId, req.params.agentId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  await query("UPDATE documents SET status = 'pending' WHERE id = $1", [doc.id])
  ingestDocument(doc.id).catch(err => console.error('Reingest error:', err))

  res.json({ message: 'Re-ingestion started' })
})

// DELETE /agents/:agentId/documents/:docId
router.delete('/:agentId/documents/:docId', authMiddleware, async (req: Request, res: Response) => {
  const agent = await getAgentForTenant(req.params.agentId, req.tenantId!)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const doc = await queryOne<Document>(
    'SELECT * FROM documents WHERE id = $1 AND agent_id = $2',
    [req.params.docId, req.params.agentId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  await deleteDocumentChunks(doc.id)
  await query('DELETE FROM documents WHERE id = $1', [doc.id])

  // Clean up file
  if (doc.file_path && fs.existsSync(doc.file_path)) {
    fs.unlinkSync(doc.file_path)
  }

  res.json({ success: true })
})

// GET /agents/:agentId/documents/:docId/status
router.get('/:agentId/documents/:docId/status', authMiddleware, async (req: Request, res: Response) => {
  const doc = await queryOne<Pick<Document, 'id' | 'status' | 'chunk_count' | 'error_message'>>(
    'SELECT id, status, chunk_count, error_message FROM documents WHERE id = $1 AND agent_id = $2',
    [req.params.docId, req.params.agentId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  res.json(doc)
})

export default router
