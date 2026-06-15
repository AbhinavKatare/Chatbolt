import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { logger } from '../services/logger.service'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import ExcelJS from 'exceljs'

const router = Router()

const scrapeLimit = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Scrape rate limit exceeded' } })

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
})

// ── POST /multimodal/scrape-url ────────────────────────────────────────────────
// Fetches a URL and extracts clean text content

router.post('/scrape-url', authMiddleware, scrapeLimit, async (req: Request, res: Response) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  // Validate URL format
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported' })
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Chatbolt/1.0; +https://chatbolt.io)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return res.status(422).json({ error: `Could not fetch URL: ${response.status} ${response.statusText}` })
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return res.status(422).json({ error: 'URL does not return readable content (must be HTML or text)' })
    }

    const html = await response.text()

    // Clean the HTML to extract readable text
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{3,}/g, '\n\n')
      .trim()

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch?.[1]?.trim() || parsedUrl.hostname

    // Extract meta description
    const descMatch = html.match(/<meta[^+]+name=["']description["'][^+]+content=["']([^"']+)["']/i)
    const description = descMatch?.[1]?.trim() || ''

    // Trim to max 8000 chars for context use
    const truncated = cleaned.length > 8000 ? cleaned.slice(0, 8000) + '\n\n[Content truncated for length]' : cleaned
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length

    logger.info(`[Multimodal] Scraped URL ${parsedUrl.hostname} — ${wordCount} words for tenant ${req.tenantId}`)

    return res.json({
      url: parsedUrl.toString(),
      title,
      description,
      content: truncated,
      word_count: wordCount,
      domain: parsedUrl.hostname,
      truncated: cleaned.length > 8000,
    })
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timed out after 10 seconds' })
    }
    logger.error('[Multimodal] URL scrape error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch URL content' })
  }
})

// ── POST /multimodal/describe-image ───────────────────────────────────────────
// Sends a base64 image to vision LLM and returns a description

router.post('/describe-image', authMiddleware, async (req: Request, res: Response) => {
  const { image_base64, mime_type = 'image/jpeg', prompt = 'Describe this image in detail.' } = req.body

  if (!image_base64) {
    return res.status(400).json({ error: 'image_base64 is required' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
  const model = process.env.OPENROUTER_API_KEY ? 'openai/gpt-4o' : 'gpt-4o'

  if (!apiKey) {
    return res.status(503).json({ error: 'Vision AI is not configured' })
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime_type};base64,${image_base64}` } },
            { type: 'text', text: prompt },
          ],
        }],
        max_tokens: 500,
      }),
    }).then(r => r.json())

    const description = response.choices?.[0]?.message?.content || 'Could not describe image.'
    return res.json({ description })
  } catch (err: any) {
    logger.error('[Multimodal] Vision error:', err.message)
    return res.status(500).json({ error: 'Image description failed' })
  }
})

// ── POST /multimodal/upload ───────────────────────────────────────────
// Accepts files (PDF, DOCX, XLSX, CSV, images, text) and returns parsed content

router.post('/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' })
  }

  const file = req.file
  const filename = file.originalname.toLowerCase()
  const mime = file.mimetype.toLowerCase()

  try {
    let parsedText = ''

    if (mime.includes('pdf') || filename.endsWith('.pdf')) {
      const parsedPdf = await pdfParse(Buffer.from(file.buffer))
      parsedText = parsedPdf.text || ''
    } 
    else if (mime.includes('word') || filename.endsWith('.docx')) {
      const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(file.buffer) })
      parsedText = docxResult.value || ''
    } 
    else if (mime.includes('sheet') || mime.includes('excel') || filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(Buffer.from(file.buffer) as any)
      let sheetTexts: string[] = []
      workbook.eachSheet((sheet) => {
        sheetTexts.push(`Sheet: ${sheet.name}`)
        sheet.eachRow((row) => {
          const rowVals = Array.isArray(row.values) 
            ? row.values.slice(1) 
            : Object.values(row.values || {})
          sheetTexts.push(rowVals.join(', '))
        })
      })
      parsedText = sheetTexts.join('\n')
    } 
    else if (mime.startsWith('image/')) {
      const base64 = file.buffer.toString('base64')
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
      const baseUrl = process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
      const model = process.env.OPENROUTER_API_KEY ? 'openai/gpt-4o' : 'gpt-4o'

      if (!apiKey) {
        return res.status(503).json({ error: 'Vision AI is not configured to parse images' })
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
              { type: 'text', text: 'Describe this image in detail, including any text, charts, or data you see.' },
            ],
          }],
          max_tokens: 500,
        }),
      }).then(r => r.json())

      parsedText = response.choices?.[0]?.message?.content || 'Could not describe image.'
    } 
    else {
      // Treat as plain text / markdown / CSV
      parsedText = file.buffer.toString('utf8')
    }

    return res.json({ text: parsedText })
  } catch (err: any) {
    logger.error(`[Multimodal] File upload parsing failed for ${file.originalname}:`, err.message)
    return res.status(500).json({ error: `Failed to parse file: ${err.message}` })
  }
})

export default router
