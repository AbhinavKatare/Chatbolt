import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { query, queryOne } from '../db'
import { z } from 'zod'

const router = Router()
router.use(authMiddleware)

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  source: z.enum(['website', 'whatsapp', 'api', 'manual', 'import', 'chat', 'other']).default('manual'),
  status: z.enum(['lead', 'qualified', 'customer', 'churned', 'archived']).default('lead'),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional(),
})

// 1. List contacts (with search, filter, pagination)
router.get('/', async (req, res) => {
  try {
    const { search, status, source, page = '1', limit = '50' } = req.query
    const offset = (parseInt(String(page)) - 1) * parseInt(String(limit))

    const conditions = ['c.tenant_id = $1']
    const params: any[] = [req.tenantId]
    let paramIdx = 2

    if (search) {
      conditions.push(`(c.name ILIKE $${paramIdx} OR c.email ILIKE $${paramIdx} OR c.company ILIKE $${paramIdx})`)
      params.push(`%${search}%`)
      paramIdx++
    }
    if (status) {
      conditions.push(`c.status = $${paramIdx}`)
      params.push(status)
      paramIdx++
    }
    if (source) {
      conditions.push(`c.source = $${paramIdx}`)
      params.push(source)
      paramIdx++
    }

    const where = conditions.join(' AND ')

    const contacts = await query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM contact_interactions ci WHERE ci.contact_id = c.id) as interaction_count
       FROM contacts c
       WHERE ${where}
       ORDER BY c.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(String(limit)), offset]
    )

    const [{ count }] = await query(
      `SELECT COUNT(*) as count FROM contacts c WHERE ${where}`,
      params
    )

    // Summary stats
    const stats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'lead' THEN 1 END) as leads,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
        COUNT(CASE WHEN status = 'customer' THEN 1 END) as customers,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week
       FROM contacts WHERE tenant_id = $1`,
      [req.tenantId]
    )

    res.json({ contacts, total: parseInt(count), stats: stats[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Get single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await queryOne(
      'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!contact) return res.status(404).json({ error: 'Contact not found' })

    const interactions = await query(
      'SELECT * FROM contact_interactions WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    )

    res.json({ contact, interactions })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 3. Create contact
router.post('/', async (req, res) => {
  try {
    const body = contactSchema.parse(req.body)
    const [contact] = await query(
      `INSERT INTO contacts (tenant_id, name, email, phone, company, title, source, status, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.tenantId, body.name, body.email || null, body.phone || null,
        body.company || null, body.title || null, body.source, body.status,
        body.notes || null, JSON.stringify(body.tags || [])
      ]
    )
    res.status(201).json({ contact })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 4. Update contact
router.patch('/:id', async (req, res) => {
  try {
    const body = contactSchema.partial().parse(req.body)
    const existing = await queryOne(
      'SELECT id FROM contacts WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    )
    if (!existing) return res.status(404).json({ error: 'Contact not found' })

    const [contact] = await query(
      `UPDATE contacts SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        company = COALESCE($4, company),
        title = COALESCE($5, title),
        source = COALESCE($6, source),
        status = COALESCE($7, status),
        notes = COALESCE($8, notes),
        tags = COALESCE($9::jsonb, tags),
        updated_at = NOW()
       WHERE id = $10 AND tenant_id = $11
       RETURNING *`,
      [
        body.name || null, body.email || null, body.phone || null,
        body.company || null, body.title || null, body.source || null,
        body.status || null, body.notes || null,
        body.tags ? JSON.stringify(body.tags) : null,
        req.params.id, req.tenantId
      ]
    )
    res.json({ contact })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    res.status(500).json({ error: err.message })
  }
})

// 5. Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      "UPDATE contacts SET status = 'archived', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [req.params.id, req.tenantId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 6. Add interaction (note, call, email, etc.)
router.post('/:id/interactions', async (req, res) => {
  try {
    const { type, summary, metadata } = req.body
    if (!type || !summary) return res.status(400).json({ error: 'type and summary required' })

    const [interaction] = await query(
      `INSERT INTO contact_interactions (contact_id, tenant_id, type, summary, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.tenantId, type, summary, JSON.stringify(metadata || {})]
    )
    res.status(201).json({ interaction })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 7. Bulk import contacts
router.post('/bulk-import', async (req, res) => {
  try {
    const { contacts: contactList } = req.body
    if (!Array.isArray(contactList) || contactList.length === 0) {
      return res.status(400).json({ error: 'contacts array is required' })
    }

    const created = []
    const errors = []
    for (const c of contactList.slice(0, 1000)) {
      try {
        const body = contactSchema.parse({ ...c, source: c.source || 'import' })
        const [contact] = await query(
          `INSERT INTO contacts (tenant_id, name, email, phone, company, source, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (tenant_id, email) DO UPDATE SET
             name = EXCLUDED.name, phone = EXCLUDED.phone, updated_at = NOW()
           RETURNING id, name, email`,
          [req.tenantId, body.name, body.email || null, body.phone || null,
           body.company || null, body.source, body.status, body.notes || null]
        )
        created.push(contact)
      } catch (e: any) {
        errors.push({ row: c, error: e.message })
      }
    }

    res.json({ created: created.length, errors: errors.length, contacts: created })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 8. Export contacts as CSV-like JSON
router.get('/export/all', async (req, res) => {
  try {
    const contacts = await query(
      'SELECT name, email, phone, company, title, source, status, notes, created_at FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.tenantId]
    )
    res.json({ contacts })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
