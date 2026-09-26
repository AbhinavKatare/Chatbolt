import { Router, Request, Response } from 'express'
import { semanticCodeSearchService } from '../services/semantic-code-search.service'
import { progressiveToolDisclosureService } from '../services/progressive-tool-disclosure.service'
import { agentRuntimeClient } from '../services/agent-runtime-client.service'
import { logger } from '../services/logger.service'

const router = Router()

/**
 * POST /api/code/index
 * Incrementally index target repository directory for semantic search
 */
router.post('/index', async (req: Request, res: Response) => {
  try {
    const { repoPath, extensions } = req.body
    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' })
    }

    const result = await semanticCodeSearchService.indexRepository(repoPath, extensions)
    return res.json({
      success: true,
      data: result
    })
  } catch (err: any) {
    logger.error(`[CodeSearchRoute] Indexing failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/code/search
 * Semantic code search returning relevant chunks with file:line tags
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, topK = 5, pathFilter } = req.body
    if (!query) {
      return res.status(400).json({ error: 'query is required' })
    }

    const results = await semanticCodeSearchService.searchCode(query, Number(topK) || 5, pathFilter)
    return res.json({
      success: true,
      total: results.length,
      results
    })
  } catch (err: any) {
    logger.error(`[CodeSearchRoute] Search failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/code/apply-diff
 * Applies targeted diff hunks via Go sandboxed runtime
 */
router.post('/apply-diff', async (req: Request, res: Response) => {
  try {
    const { filePath, hunks, unifiedDiff, originalContent, fallbackToFull } = req.body
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' })
    }

    const result = await agentRuntimeClient.applyFileDiff({
      filePath,
      originalContent,
      hunks,
      unifiedDiff,
      fallbackToFull
    })

    if (!result.success) {
      return res.status(422).json(result)
    }

    return res.json(result)
  } catch (err: any) {
    logger.error(`[CodeSearchRoute] Diff application failed: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/code/tool-output/:ref
 * Progressively inspect a chunk of large tool output
 */
router.get('/tool-output/:ref', (req: Request, res: Response) => {
  try {
    const { ref } = req.params
    const offset = parseInt(req.query.offset as string || '0', 10)
    const limit = parseInt(req.query.limit as string || '50', 10)

    const chunk = progressiveToolDisclosureService.fetchChunk(ref, offset, limit)
    return res.json({
      success: true,
      data: chunk
    })
  } catch (err: any) {
    return res.status(404).json({ error: err.message })
  }
})

export default router
