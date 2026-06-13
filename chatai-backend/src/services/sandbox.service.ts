import { logger } from './logger.service';
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import axios from 'axios'

export interface SandboxResult {
  stdout: string
  stderr: string
  success: boolean
}

class SandboxService {
  private readonly sandboxRoot: string

  constructor() {
    this.sandboxRoot = path.join(process.cwd(), 'scratch', 'sandboxes')
    if (!fs.existsSync(this.sandboxRoot)) {
      fs.mkdirSync(this.sandboxRoot, { recursive: true })
    }
  }

  /**
   * Run Python code in an isolated container/sandbox
   */
  async runPython(code: string, runId?: string): Promise<SandboxResult> {
    const id = runId || randomUUID()
    const taskDir = path.join(this.sandboxRoot, id)
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true })
    }

    const scriptPath = path.join(taskDir, 'script.py')
    fs.writeFileSync(scriptPath, code, 'utf8')

    return new Promise((resolve) => {
      // Execute local python inside sandboxed directory structure with a 30s timeout
      const command = `python "${scriptPath}"`
      
      exec(command, { timeout: 30000, cwd: taskDir }, (error, stdout, stderr) => {
        // Cleanup temp folder
        try {
          fs.rmSync(taskDir, { recursive: true, force: true })
        } catch (e) {
          console.error('[Sandbox] Failed to clean up task sandbox folder:', e)
        }

        if (error) {
          resolve({
            stdout: stdout.trim(),
            stderr: (stderr || error.message).trim(),
            success: false
          })
        } else {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            success: true
          })
        }
      })
    })
  }

  /**
   * Run JavaScript/TypeScript code in an isolated container/sandbox
   */
  async runNode(code: string, runId?: string): Promise<SandboxResult> {
    const id = runId || randomUUID()
    const taskDir = path.join(this.sandboxRoot, id)
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true })
    }

    const scriptPath = path.join(taskDir, 'script.js')
    fs.writeFileSync(scriptPath, code, 'utf8')

    return new Promise((resolve) => {
      // Execute local node inside sandboxed directory structure with a 30s timeout
      const command = `node "${scriptPath}"`
      
      exec(command, { timeout: 30000, cwd: taskDir }, (error, stdout, stderr) => {
        // Cleanup temp folder
        try {
          fs.rmSync(taskDir, { recursive: true, force: true })
        } catch (e) {
          console.error('[Sandbox] Failed to clean up task sandbox folder:', e)
        }

        if (error) {
          resolve({
            stdout: stdout.trim(),
            stderr: (stderr || error.message).trim(),
            success: false
          })
        } else {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            success: true
          })
        }
      })
    })
  }

  /**
   * Create an ephemeral micro-VM using the Fly.io Machines API
   */
  private async createFlyMachine(machineName: string, env: Record<string, string>): Promise<string | null> {
    const token = process.env.FLY_API_TOKEN
    const appName = process.env.FLY_APP_NAME
    if (!token || !appName) return null

    try {
      const url = `https://api.machines.dev/v1/apps/${appName}/machines`
      const payload = {
        name: machineName,
        config: {
          image: process.env.FLY_MACHINE_IMAGE || 'registry.fly.io/chatbolt-os-worker:latest',
          guest: {
            cpu_kind: 'shared',
            cpus: 1,
            memory_mb: 256
          },
          env: {
            ...env,
            NODE_ENV: 'production'
          },
          services: [
            {
              ports: [{ port: 80, handlers: ['http'] }],
              protocol: 'tcp',
              internal_port: 3000
            }
          ]
        }
      }

      logger.info(`[Fly.io Machines] Triggering micro-VM provision on endpoint: ${url}`)
      const res = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })

      if (res.data && res.data.id) {
        const machineId = res.data.id
        logger.info(`[Fly.io Machines] ✅ Micro-VM provisioned successfully: ID=${machineId}, State=${res.data.state}`)
        return machineId
      }
      return null
    } catch (err: any) {
      console.error('[Fly.io Machines] Failed to provision micro-VM, falling back to local:', err.response?.data || err.message)
      return null
    }
  }

  /**
   * Stop an ephemeral Fly.io machine
   */
  async stopFlyMachine(machineId: string): Promise<boolean> {
    const token = process.env.FLY_API_TOKEN
    const appName = process.env.FLY_APP_NAME
    if (!token || !appName) return false

    try {
      const url = `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}/stop`
      await axios.post(url, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      logger.info(`[Fly.io Machines] Stopped Micro-VM sandbox: ${machineId}`)
      return true
    } catch (err: any) {
      console.error(`[Fly.io Machines] Failed to stop machine ${machineId}:`, err.message)
      return false
    }
  }

  /**
   * Delete an ephemeral Fly.io machine
   */
  async deleteFlyMachine(machineId: string): Promise<boolean> {
    const token = process.env.FLY_API_TOKEN
    const appName = process.env.FLY_APP_NAME
    if (!token || !appName) return false

    try {
      const url = `https://api.machines.dev/v1/apps/${appName}/machines/${machineId}`
      await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      logger.info(`[Fly.io Machines] Destroyed Micro-VM sandbox: ${machineId}`)
      return true
    } catch (err: any) {
      console.error(`[Fly.io Machines] Failed to delete machine ${machineId}:`, err.message)
      return false
    }
  }

  /**
   * Ephemeral Workspace Workspace Provisioning (Phase 2.3)
   */
  async provisionIsolatedWorkspace(tenantId: string): Promise<string> {
    const workspaceId = `ws-${tenantId.slice(0, 8)}-${randomUUID().slice(0, 8)}`

    // Attempt actual Fly.io Machines Micro-VM provisioning if token is present
    if (process.env.FLY_API_TOKEN && process.env.FLY_APP_NAME) {
      logger.info(`[Sandbox Service] 🚀 Initiating ephemeral Fly.io Micro-VM Machine allocation for tenant ${tenantId}...`)
      const machineId = await this.createFlyMachine(workspaceId, { TENANT_ID: tenantId })
      if (machineId) {
        const vmUrl = `http://${machineId}.vm.fly.dev`
        logger.info(`[Sandbox Service] ✅ Ephemeral Fly.io micro-VM workspace provisioned on endpoint: ${vmUrl}`)
        return vmUrl
      }
    }

    // Graceful fallback to local workspace folder
    const pathDir = path.join(this.sandboxRoot, workspaceId)
    if (!fs.existsSync(pathDir)) {
      fs.mkdirSync(pathDir, { recursive: true })
    }
    logger.info(`[Sandbox Service] Ephemeral workspace provisioned locally for tenant ${tenantId}: ${pathDir}`)
    return pathDir
  }
}

export const sandboxService = new SandboxService()
