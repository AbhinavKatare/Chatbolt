import { logger } from './logger.service';
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import axios from 'axios'
import { agentRuntimeClient } from './agent-runtime-client.service'

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
   * Generates a sanitized, stripped environment for subprocess execution.
   * Strips all application secrets, API keys, database URLs, and master keys.
   */
  private getSanitizedEnv(customDir: string): NodeJS.ProcessEnv {
    const isWindows = process.platform === 'win32'
    const minimalEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      PATH: process.env.PATH || (isWindows ? 'C:\\Windows\\System32;C:\\Windows' : '/usr/local/bin:/usr/bin:/bin'),
      TMP: customDir,
      TEMP: customDir,
      TMPDIR: customDir,
      HOME: customDir,
      USERPROFILE: customDir,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONUNBUFFERED: '1',
      NODE_NO_WARNINGS: '1',
    }

    if (isWindows) {
      if (process.env.SYSTEMROOT) minimalEnv.SYSTEMROOT = process.env.SYSTEMROOT
      if (process.env.COMSPEC) minimalEnv.COMSPEC = process.env.COMSPEC
      if (process.env.PATHEXT) minimalEnv.PATHEXT = process.env.PATHEXT
    }

    return minimalEnv
  }

  /**
   * Executes a command within an isolated directory with a strict timeout,
   * stripped environment variables, and process tree termination on timeout.
   */
  private async executeSafely(
    command: string,
    taskDir: string,
    timeoutMs = 30000
  ): Promise<SandboxResult> {
    return new Promise((resolve) => {
      const sanitizedEnv = this.getSanitizedEnv(taskDir)
      
      // On Unix/Linux, apply ulimit to restrict memory (512MB), CPU time (30s), and max file output size
      const isUnix = process.platform !== 'win32'
      const finalCommand = isUnix 
        ? `ulimit -v 524288 -t 30 -f 50000 2>/dev/null || true; ${command}`
        : command

      let child: any = null
      let isTimedOut = false

      const timer = setTimeout(() => {
        isTimedOut = true
        if (child) {
          try {
            if (process.platform === 'win32') {
              exec(`taskkill /pid ${child.pid} /T /F`, { windowsHide: true }, () => {})
            } else {
              child.kill('SIGKILL')
            }
          } catch (kErr) {
            // Process might have already exited
          }
        }
      }, timeoutMs)

      try {
        child = exec(
          finalCommand,
          {
            timeout: timeoutMs + 1000,
            cwd: taskDir,
            env: sanitizedEnv,
            maxBuffer: 1024 * 512, // 512KB max output buffer
            windowsHide: true
          },
          (error, stdout, stderr) => {
            clearTimeout(timer)

            // Force cleanup of temporary directory
            try {
              fs.rmSync(taskDir, { recursive: true, force: true })
            } catch (e) {
              console.error('[Sandbox] Failed to clean up task sandbox folder:', e)
            }

            if (isTimedOut) {
              return resolve({
                stdout: (stdout || '').trim(),
                stderr: `Execution timed out after ${timeoutMs / 1000}s (Subprocess terminated).`,
                success: false
              })
            }

            if (error) {
              return resolve({
                stdout: (stdout || '').trim(),
                stderr: (stderr || error.message || 'Execution error').trim(),
                success: false
              })
            }

            return resolve({
              stdout: (stdout || '').trim(),
              stderr: (stderr || '').trim(),
              success: true
            })
          }
        )
      } catch (spawnErr: any) {
        clearTimeout(timer)
        try {
          fs.rmSync(taskDir, { recursive: true, force: true })
        } catch {}

        return resolve({
          stdout: '',
          stderr: `Subprocess spawn error: ${spawnErr.message}`,
          success: false
        })
      }
    })
  }

  /**
   * Run Python code in an isolated, sanitized container/sandbox
   */
  async runPython(code: string, runId?: string): Promise<SandboxResult> {
    const id = runId || randomUUID()

    // 1. Check if Go agent-runtime service is available
    if (await agentRuntimeClient.isAvailable()) {
      try {
        const goRes = await agentRuntimeClient.executeSandboxCode({
          execution_id: id,
          language: 'python',
          code,
          timeout_seconds: 30,
        })
        return {
          stdout: goRes.stdout,
          stderr: goRes.stderr,
          success: goRes.success,
        }
      } catch (err: any) {
        logger.warn(`[Sandbox] Go runtime execution failed, falling back to local: ${err.message}`)
      }
    }

    // 2. Local fallback runner
    const taskDir = path.join(this.sandboxRoot, id)
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true })
    }

    const scriptPath = path.join(taskDir, 'script.py')
    fs.writeFileSync(scriptPath, code, 'utf8')

    return this.executeSafely(`python "${scriptPath}"`, taskDir, 30000)
  }

  /**
   * Run JavaScript/TypeScript code in an isolated, sanitized container/sandbox
   */
  async runNode(code: string, runId?: string): Promise<SandboxResult> {
    const id = runId || randomUUID()

    // 1. Check if Go agent-runtime service is available
    if (await agentRuntimeClient.isAvailable()) {
      try {
        const goRes = await agentRuntimeClient.executeSandboxCode({
          execution_id: id,
          language: 'node',
          code,
          timeout_seconds: 30,
        })
        return {
          stdout: goRes.stdout,
          stderr: goRes.stderr,
          success: goRes.success,
        }
      } catch (err: any) {
        logger.warn(`[Sandbox] Go runtime execution failed, falling back to local: ${err.message}`)
      }
    }

    // 2. Local fallback runner
    const taskDir = path.join(this.sandboxRoot, id)
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true })
    }

    const scriptPath = path.join(taskDir, 'script.js')
    fs.writeFileSync(scriptPath, code, 'utf8')

    return this.executeSafely(`node "${scriptPath}"`, taskDir, 30000)
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
