import { Request, Response, NextFunction } from 'express'

export function requireCredits(req: Request, res: Response, next: NextFunction) {
  const tenant = req.tenant
  if (!tenant) return res.status(401).json({ error: 'Unauthorized' })

  if (tenant.credits_remaining <= 0) {
    return res.status(402).json({
      error: 'No credits remaining',
      code: 'CREDITS_EXHAUSTED',
      upgrade_url: `${process.env.FRONTEND_URL}/pricing`,
    })
  }
  next()
}
