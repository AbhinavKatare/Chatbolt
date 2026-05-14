import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDailyReports, generateDailyReport } from '../services/daily-reporter.service';

const router = Router();

// GET /reports
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const reports = await getDailyReports(req.tenantId!, limit);
    res.json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /reports/generate (Manual trigger for testing/demo)
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const report = await generateDailyReport(req.tenantId!);
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
