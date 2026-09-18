import crypto from 'crypto'

export const LEGACY_FALLBACK_KEY = 'chatbolt_secure_encryption_key_2026_super_secret_32_bytes_long!'
const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

/**
 * Normalizes the master vault encryption key to 32 bytes.
 * Throws immediately if VAULT_ENCRYPTION_KEY is not defined in environment variables.
 */
export function getSecretKey(customKey?: string): Buffer {
  const key = customKey || process.env.VAULT_ENCRYPTION_KEY
  if (!key || key.trim() === '') {
    throw new Error(
      'FATAL CONFIGURATION ERROR: VAULT_ENCRYPTION_KEY environment variable is not set. ' +
      'Refusing to start cryptographic subsystem without an explicit, secure master encryption key.'
    )
  }
  return crypto.createHash('sha256').update(key.trim()).digest()
}

export function encrypt(text: string, customKey?: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(customKey), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  // Return IV concatenated with ciphertext
  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(ciphertext: string, customKey?: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 2) throw new Error('Invalid ciphertext format')
  
  const iv = Buffer.from(parts[0], 'hex')
  const encryptedText = Buffer.from(parts[1], 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(customKey), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString('utf8')
}

export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * Re-encrypts a ciphertext from a legacy key to a new target key.
 */
export function reencrypt(ciphertext: string, legacyKey: string, newKey: string): string {
  const plaintext = decrypt(ciphertext, legacyKey)
  return encrypt(plaintext, newKey)
}
