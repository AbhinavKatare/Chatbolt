import { logger } from './logger.service';
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import { query } from '../db'

export interface BrowserSession {
  projectId: string
  browser: Browser
  context: BrowserContext
  page: Page
  lastUsed: Date
}

class BrowserFleetService {
  private activeSessions: Map<string, BrowserSession> = new Map()
  private maxSessions = 5

  /**
   * Retrieves a persistent browser session for a specific project.
   * Scopes credentials, cookies, and localstorage durably per Project.
   */
  async getSession(projectId: string): Promise<BrowserSession> {
    // 1. Return cached active session if it exists
    if (this.activeSessions.has(projectId)) {
      const session = this.activeSessions.get(projectId)!
      session.lastUsed = new Date()
      return session
    }

    // 2. Enforce active session cap (pool scaling & resource management)
    if (this.activeSessions.size >= this.maxSessions) {
      await this.cleanupOldestSession()
    }

    logger.info(`[Browser Fleet] Creating persistent, sandboxed browser profile for project: ${projectId}`)
    
    // Profile storage path for project context persistence
    const profileDir = path.join(process.cwd(), 'uploads', 'profiles', `project_${projectId}`)
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true })
    }

    // Launch persistent context
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: true,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    })

    // Setup timeouts
    context.setDefaultNavigationTimeout(30000)
    context.setDefaultTimeout(15000)

    // Ensure at least one page is active
    let page = context.pages()[0]
    if (!page) {
      page = await context.newPage()
    }

    const session: BrowserSession = {
      projectId,
      browser: context.browser() as Browser, // launchPersistentContext context.browser() can be null, but we wrapper it
      context,
      page,
      lastUsed: new Date()
    }

    this.activeSessions.set(projectId, session)
    return session
  }

  /**
   * Closes a project's browser session and flushes state to disk.
   */
  async closeSession(projectId: string): Promise<void> {
    const session = this.activeSessions.get(projectId)
    if (session) {
      logger.info(`[Browser Fleet] Persisting and closing browser profile for project: ${projectId}`)
      try {
        await session.page.close()
        await session.context.close()
      } catch (err: any) {
        console.warn(`[Browser Fleet] Error closing project context ${projectId}:`, err.message)
      }
      this.activeSessions.delete(projectId)
    }
  }

  /**
   * Identifies the least recently used session and terminates it.
   */
  private async cleanupOldestSession(): Promise<void> {
    let oldestProjectId: string | null = null
    let oldestDate = new Date()

    for (const [projectId, session] of this.activeSessions.entries()) {
      if (session.lastUsed < oldestDate) {
        oldestDate = session.lastUsed
        oldestProjectId = projectId
      }
    }

    if (oldestProjectId) {
      logger.info(`[Browser Fleet] Reclaiming resources. Closing oldest session: ${oldestProjectId}`)
      await this.closeSession(oldestProjectId)
    }
  }

  /**
   * Returns list of currently active project sessions.
   */
  getActiveSessionsInfo() {
    return Array.from(this.activeSessions.keys()).map(id => ({
      projectId: id,
      lastActive: this.activeSessions.get(id)!.lastUsed
    }))
  }

  /**
   * Shuts down all active sessions (e.g. on server close)
   */
  async shutdownAll(): Promise<void> {
    const projectIds = Array.from(this.activeSessions.keys())
    for (const id of projectIds) {
      await this.closeSession(id)
    }
    logger.info('[Browser Fleet] All browser sessions closed.')
  }
}

export const browserFleetService = new BrowserFleetService()
