/**
 * Secrets Sanitizer & Audit Service
 * Redacts high-entropy API keys, bearer tokens, passwords, and private keys from logs and inter-service payloads.
 */

const SENSITIVE_PATTERNS = [
  // OpenAI Keys
  /sk-[a-zA-Z0-9_-]{20,}/g,
  // Anthropic Keys
  /sk-ant-[a-zA-Z0-9_-]{20,}/g,
  // Google Gemini Keys
  /AIza[0-9A-Za-z-_]{35}/g,
  // Bearer Authorization Headers
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
  // Database Connection Strings with Passwords
  /postgres(ql)?:\/\/([^:]+):([^@]+)@/gi,
  // Generic Private Keys
  /-----BEGIN\s+([A-Z\s]+)-----[\s\S]*?-----END\s+\1-----/g,
  // Passwords in JSON / query params
  /"password"\s*:\s*"[^"]+"/gi,
  /"client_secret"\s*:\s*"[^"]+"/gi,
  /"secret"\s*:\s*"[^"]+"/gi,
]

export class SecretsSanitizerService {
  /**
   * Sanitizes a string, replacing detected secrets with [REDACTED_SECRET].
   */
  sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return text
    let result = text

    result = result.replace(/sk-[a-zA-Z0-9_-]{20,}/g, 'sk-***[REDACTED_KEY]***')
    result = result.replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, 'sk-ant-***[REDACTED_KEY]***')
    result = result.replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza***[REDACTED_KEY]***')
    result = result.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, 'Bearer ***[REDACTED_TOKEN]***')
    result = result.replace(/postgres(ql)?:\/\/([^:]+):([^@]+)@/gi, 'postgresql://$2:****@')
    result = result.replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"***[REDACTED_PASSWORD]***"')
    result = result.replace(/"client_secret"\s*:\s*"[^"]+"/gi, '"client_secret":"***[REDACTED_SECRET]***"')
    result = result.replace(/"secret"\s*:\s*"[^"]+"/gi, '"secret":"***[REDACTED_SECRET]***"')
    result = result.replace(/-----BEGIN\s+([A-Z\s]+)-----[\s\S]*?-----END\s+\1-----/g, '-----BEGIN $1-----\n[REDACTED_PRIVATE_KEY]\n-----END $1-----')

    return result
  }

  /**
   * Deeply sanitizes an object or error before logging or serialization.
   */
  sanitizeObject<T>(obj: T): T {
    if (!obj) return obj

    if (typeof obj === 'string') {
      return this.sanitizeText(obj) as unknown as T
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item)) as unknown as T
    }

    if (typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, val] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase()
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('token') ||
          lowerKey.includes('privatekey')
        ) {
          sanitized[key] = '***[REDACTED]***'
        } else {
          sanitized[key] = this.sanitizeObject(val)
        }
      }
      return sanitized as T
    }

    return obj
  }

  /**
   * Generates a short-lived scoped credential token for inter-service RPC calls (Node -> Go, Node -> Python).
   */
  generateScopedServiceToken(serviceName: string, ttlSeconds: number = 60): {
    token: string
    expiresAt: string
  } {
    const crypto = require('crypto')
    const nonce = crypto.randomBytes(16).toString('hex')
    const timestamp = Date.now()
    const signature = crypto
      .createHmac('sha256', process.env.VAULT_ENCRYPTION_KEY || 'chatbolt-polyglot-internal-secret')
      .update(`${serviceName}:${timestamp}:${nonce}`)
      .digest('hex')

    return {
      token: `svc_${serviceName}_${timestamp}_${signature.slice(0, 16)}`,
      expiresAt: new Date(timestamp + ttlSeconds * 1000).toISOString(),
    }
  }
}

export const secretsSanitizerService = new SecretsSanitizerService()
