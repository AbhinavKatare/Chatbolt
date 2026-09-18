import { db } from '../db'
import { encrypt, decrypt, LEGACY_FALLBACK_KEY } from '../lib/crypto'
import { encryptGCM, decryptGCM, LEGACY_INTEGRATION_KEY } from '../services/integration-registry.service'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Migration Script: Re-encrypt Vault Secrets & OAuth Tokens
 * 
 * Context:
 * Previous versions of Chatbolt utilized a hardcoded fallback encryption key in source code.
 * This migration decrypts any records encrypted with that legacy key and re-encrypts them
 * under the new, securely configured VAULT_ENCRYPTION_KEY / INTEGRATION_ENCRYPTION_KEY.
 * 
 * IMPORTANT SECURITY NOTICE:
 * Because the legacy fallback key was present in source control, all tokens previously
 * encrypted with it should be considered potentially compromised.
 * All tenants MUST be advised to rotate their integration API keys and OAuth tokens.
 */
export async function runReencryptionMigration() {
  console.log('🔒 Starting vault secret re-encryption migration...')

  const targetKey = process.env.VAULT_ENCRYPTION_KEY
  if (!targetKey) {
    throw new Error('FATAL: Target VAULT_ENCRYPTION_KEY environment variable is not set. Migration aborted.')
  }

  let vaultSuccessCount = 0
  let vaultSkippedCount = 0
  let integrationsSuccessCount = 0
  let integrationsSkippedCount = 0

  // 1. Re-encrypt user_api_vault table
  try {
    const { rows: vaultRows } = await db.query(
      'SELECT id, tenant_id, service_name, key_encrypted FROM user_api_vault WHERE key_encrypted IS NOT NULL'
    )

    console.log(`Checking ${vaultRows.length} records in user_api_vault...`)

    for (const row of vaultRows) {
      try {
        // Attempt decrypt with legacy fallback key
        const decrypted = decrypt(row.key_encrypted, LEGACY_FALLBACK_KEY)
        // If it succeeded, re-encrypt with current target key
        const reencrypted = encrypt(decrypted, targetKey)
        await db.query('UPDATE user_api_vault SET key_encrypted = $1, updated_at = NOW() WHERE id = $2', [
          reencrypted,
          row.id
        ])
        vaultSuccessCount++
      } catch (err) {
        // Was already encrypted with a different key or invalid format
        vaultSkippedCount++
      }
    }
  } catch (err: any) {
    console.warn(`user_api_vault table migration notice: ${err.message}`)
  }

  // 2. Re-encrypt user_integrations table
  try {
    const { rows: integrationRows } = await db.query(
      'SELECT id, tenant_id, service, access_token_encrypted, refresh_token_encrypted FROM user_integrations'
    )

    console.log(`Checking ${integrationRows.length} records in user_integrations...`)

    for (const row of integrationRows) {
      let updatedAccess = row.access_token_encrypted
      let updatedRefresh = row.refresh_token_encrypted
      let changed = false

      if (row.access_token_encrypted) {
        try {
          const plainAccess = decryptGCM(row.access_token_encrypted, LEGACY_INTEGRATION_KEY)
          updatedAccess = encryptGCM(plainAccess, targetKey)
          changed = true
        } catch {
          // Already on new key
        }
      }

      if (row.refresh_token_encrypted) {
        try {
          const plainRefresh = decryptGCM(row.refresh_token_encrypted, LEGACY_INTEGRATION_KEY)
          updatedRefresh = encryptGCM(plainRefresh, targetKey)
          changed = true
        } catch {
          // Already on new key
        }
      }

      if (changed) {
        await db.query(
          'UPDATE user_integrations SET access_token_encrypted = $1, refresh_token_encrypted = $2, updated_at = NOW() WHERE id = $3',
          [updatedAccess, updatedRefresh, row.id]
        )
        integrationsSuccessCount++
      } else {
        integrationsSkippedCount++
      }
    }
  } catch (err: any) {
    console.warn(`user_integrations table migration notice: ${err.message}`)
  }

  console.log('✅ Re-encryption Migration Summary:')
  console.log(`  - user_api_vault: ${vaultSuccessCount} re-encrypted, ${vaultSkippedCount} kept as-is`)
  console.log(`  - user_integrations: ${integrationsSuccessCount} re-encrypted, ${integrationsSkippedCount} kept as-is`)
  console.log('⚠️  TENANT ACTION REQUIRED: Please notify all tenants to rotate their connected credentials.')
}

if (require.main === module) {
  runReencryptionMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
