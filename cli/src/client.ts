import http from 'http'
import https from 'https'
import { URL } from 'url'

export interface CLIConfig {
  apiUrl: string
  apiKey?: string
  tenantId: string
}

export class ChatboltClient {
  private config: CLIConfig

  constructor(customConfig?: Partial<CLIConfig>) {
    this.config = {
      apiUrl: process.env.CHATBOLT_API_URL || customConfig?.apiUrl || 'http://127.0.0.1:4000',
      apiKey: process.env.CHATBOLT_API_KEY || customConfig?.apiKey || 'cb_test_key_dev',
      tenantId: process.env.CHATBOLT_TENANT_ID || customConfig?.tenantId || '00000000-0000-0000-0000-000000000000'
    }
  }

  getConfig(): CLIConfig {
    return { ...this.config }
  }

  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; data: T }> {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.config.apiUrl)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const payload = body ? JSON.stringify(body) : undefined

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-tenant-id': this.config.tenantId,
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...headers
    }

    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString()
    }

    return new Promise((resolve, reject) => {
      const req = lib.request(
        url,
        {
          method,
          headers: reqHeaders,
          timeout: 30000
        },
        (res) => {
          let rawData = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            rawData += chunk
          })
          res.on('end', () => {
            let parsed: any = rawData
            try {
              parsed = rawData ? JSON.parse(rawData) : {}
            } catch {
              // Raw string fallback
            }
            resolve({
              status: res.statusCode || 200,
              data: parsed
            })
          })
        }
      )

      req.on('error', (err) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request to ${url.toString()} timed out after 30s`))
      })

      if (payload) {
        req.write(payload)
      }
      req.end()
    })
  }

  /**
   * Connect to Server-Sent Events (SSE) stream for real-time task progress
   */
  async streamSSE(
    path: string,
    onEvent: (event: { event: string; data: any }) => void,
    onError?: (err: Error) => void,
    onClose?: () => void
  ): Promise<() => void> {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.config.apiUrl)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const req = lib.request(
      url,
      {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-tenant-id': this.config.tenantId,
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      },
      (res) => {
        let buffer = ''
        res.setEncoding('utf8')

        res.on('data', (chunk: string) => {
          buffer += chunk
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const rawMessage of lines) {
            if (!rawMessage.trim()) continue
            let eventType = 'message'
            let dataStr = ''

            const msgLines = rawMessage.split('\n')
            for (const line of msgLines) {
              if (line.startsWith('event:')) {
                eventType = line.replace('event:', '').trim()
              } else if (line.startsWith('data:')) {
                dataStr += line.replace('data:', '').trim()
              }
            }

            try {
              const parsedData = dataStr ? JSON.parse(dataStr) : {}
              onEvent({ event: eventType, data: parsedData })
            } catch {
              onEvent({ event: eventType, data: dataStr })
            }
          }
        })

        res.on('end', () => {
          if (onClose) onClose()
        })

        res.on('error', (err) => {
          if (onError) onError(err)
        })
      }
    )

    req.on('error', (err) => {
      if (onError) onError(err)
    })

    req.end()

    return () => {
      try {
        req.destroy()
      } catch {}
    }
  }
}
