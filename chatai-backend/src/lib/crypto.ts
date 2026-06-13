import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.VAULT_ENCRYPTION_KEY || 'chatbolt_secure_encryption_key_2026_super_secret_32_bytes_long!' // Must be 32 bytes or longer
const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

// Normalize key to 32 bytes
function getSecretKey() {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  // Return IV concatenated with ciphertext
  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 2) throw new Error('Invalid ciphertext format')
  
  const iv = Buffer.from(parts[0], 'hex')
  const encryptedText = Buffer.from(parts[1], 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString('utf8')
}

export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}
