import { Router, Request, Response } from 'express'
import { enterpriseLicenseService } from '../enterprise/enterprise-license.service'
import { authMiddleware } from '../middleware/auth.middleware'
import { db } from '../db'
import { logger } from '../services/logger.service'

const router = Router()

/**
 * POST /api/enterprise/activate-license
 * Activates a cryptographic enterprise license key for the authenticated tenant
 */
router.post('/activate-license', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id
    const { licenseKey } = req.body

    if (!licenseKey) {
      return res.status(400).json({ error: 'licenseKey is required in request body' })
    }

    const validation = enterpriseLicenseService.validateLicenseKey(licenseKey, tenantId)
    if (!validation.valid) {
      return res.status(400).json({ error: 'INVALID_LICENSE_KEY', message: validation.error })
    }

    // Persist key into tenant metadata
    try {
      const { rows } = await db.query('SELECT metadata FROM tenants WHERE id = $1', [tenantId])
      const currentMeta = rows[0]?.metadata ? (typeof rows[0].metadata === 'string' ? JSON.parse(rows[0].metadata) : rows[0].metadata) : {}
      const updatedMeta = {
        ...currentMeta,
        enterprise_license_key: licenseKey,
        enterprise_activated_at: new Date().toISOString()
      }

      await db.query(
        'UPDATE tenants SET metadata = $1, plan = $2 WHERE id = $3',
        [JSON.stringify(updatedMeta), 'enterprise', tenantId]
      )
    } catch (dbErr: any) {
      logger.warn('[EnterpriseRoutes] Could not save license key to DB (using memory cache): ' + dbErr.message)
    }

    return res.json({
      success: true,
      message: 'Enterprise license key successfully activated.',
      entitlements: validation.entitlements
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/enterprise/license-status
 * Queries the enterprise license status and entitlements for the current tenant
 */
router.get('/license-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenant?.id
    const status = await enterpriseLicenseService.verifyTenantEnterpriseStatus(tenantId)

    return res.json({
      isEnterprise: status.valid,
      entitlements: status.entitlements || null,
      isCachedGracePeriod: status.isCachedGracePeriod || false,
      message: status.valid ? 'Enterprise license active' : status.error
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
