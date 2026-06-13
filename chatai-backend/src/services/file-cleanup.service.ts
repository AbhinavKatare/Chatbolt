import fs from 'fs'
import path from 'path'
import cron from 'node-cron'
import { db } from '../db'
import { logger } from './logger.service'

class FileCleanupService {
  start() {
    logger.info('[File Cleanup] Initializing daily file cleanup cron job (0 2 * * *)...')
    cron.schedule('0 2 * * *', async () => {
      await this.runCleanup()
    })
  }

  async runCleanup() {
    logger.info('[File Cleanup] Running file cleanup task...')
    let deletedCount = 0

    // 1. Delete files in /tmp/uploads/ older than 24 hours
    const tmpUploadsDir = path.join(process.cwd(), 'tmp/uploads')
    const tmpUploadsDirAbsolute = '/tmp/uploads'
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000

    const cleanTmpDir = (dirPath: string) => {
      if (fs.existsSync(dirPath)) {
        try {
          const files = fs.readdirSync(dirPath)
          for (const file of files) {
            const filePath = path.join(dirPath, file)
            const stats = fs.statSync(filePath)
            if (now - stats.mtimeMs > oneDayMs) {
              fs.unlinkSync(filePath)
              deletedCount++
            }
          }
        } catch (err: any) {
          logger.warn(`[File Cleanup] Error cleaning directory ${dirPath}: ${err.message}`)
        }
      }
    }

    cleanTmpDir(tmpUploadsDir)
    cleanTmpDir(tmpUploadsDirAbsolute)

    // 2. Delete files in /public/downloads/ with no corresponding artifacts table row (orphaned)
    const publicDownloadsDir = path.join(process.cwd(), 'public/downloads')
    const publicDownloadsDirAbsolute = '/public/downloads'

    const cleanOrphanedDownloads = async (dirPath: string) => {
      if (fs.existsSync(dirPath)) {
        try {
          const files = fs.readdirSync(dirPath)
          for (const file of files) {
            const filePath = path.join(dirPath, file)
            // Check if there is an artifact with this file_path or name
            const artifactCheck = await db.query(
              `SELECT id FROM artifacts WHERE file_path LIKE $1 OR name = $2`,
              [`%${file}%`, file]
            )
            if (artifactCheck.rows.length === 0) {
              fs.unlinkSync(filePath)
              deletedCount++
            }
          }
        } catch (err: any) {
          logger.warn(`[File Cleanup] Error cleaning orphaned downloads in ${dirPath}: ${err.message}`)
        }
      }
    }

    await cleanOrphanedDownloads(publicDownloadsDir)
    await cleanOrphanedDownloads(publicDownloadsDirAbsolute)

    // 3. Delete artifact files where workflow_run.created_at < now()-30days AND artifact.starred is null or false
    try {
      const colCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'artifacts' AND column_name = 'starred'
      `)
      const hasStarredCol = colCheck.rows.length > 0
      
      const starredCondition = hasStarredCol 
        ? "(a.starred IS NULL OR a.starred = false)" 
        : "(COALESCE((a.metadata->>'starred')::boolean, false) = false)"

      const artifactsQuery = `
        SELECT a.id, a.file_path 
        FROM artifacts a
        LEFT JOIN workflow_runs wr ON wr.id = (
          CASE 
            WHEN a.metadata->'source_tasks' IS NOT NULL AND jsonb_array_length(a.metadata->'source_tasks') > 0 
            THEN (a.metadata->'source_tasks'->>0)::uuid 
            ELSE NULL 
          END
        )
        WHERE (wr.created_at < NOW() - INTERVAL '30 days' OR (wr.id IS NULL AND a.created_at < NOW() - INTERVAL '30 days'))
        AND ${starredCondition}
      `
      const { rows: oldArtifacts } = await db.query(artifactsQuery)

      for (const art of oldArtifacts) {
        if (art.file_path) {
          let resolvedPath = art.file_path
          if (!path.isAbsolute(resolvedPath)) {
            resolvedPath = path.join(process.cwd(), resolvedPath)
          }
          try {
            if (fs.existsSync(resolvedPath)) {
              fs.unlinkSync(resolvedPath)
              deletedCount++
            }
          } catch (err: any) {
            logger.warn(`[File Cleanup] Error deleting artifact file ${resolvedPath}: ${err.message}`)
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[File Cleanup] Error cleaning old artifacts: ${err.message}`)
    }

    logger.info(`[File Cleanup] Cleanup complete. Deleted ${deletedCount} files.`)
  }
}

export const fileCleanupService = new FileCleanupService()
