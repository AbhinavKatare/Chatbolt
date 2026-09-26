import { ChatboltClient } from '../client'

export interface SecurityCliOptions {
  action: 'trust' | 'audit' | 'export' | 'compliance' | 'inventory' | 'purge'
  format?: 'json' | 'csv'
  category?: string
  userId?: string
  limit?: number
  scope?: 'all' | 'memory' | 'replays'
  json?: boolean
}

export async function securityCommand(
  options: SecurityCliOptions,
  client: ChatboltClient = new ChatboltClient()
): Promise<any> {
  const { action, format = 'json', category, userId, limit = 20, scope = 'all', json } = options

  try {
    if (action === 'trust') {
      const res = await client.request('GET', '/api/security/trust-center')
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const t = res.data.trustReport
      console.log(`\n🛡️  Chatbolt Enterprise Security & Trust Posture`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      console.log(`  Architecture:       ${t.overview.securityModel}`)
      console.log(`  Key Management:     ${t.overview.byokModel}`)
      console.log(`  Encryption Transit: ${t.encryption.inTransit}`)
      console.log(`  Encryption Rest:    ${t.encryption.atRest}`)
      console.log(`  Access Control:     ${t.accessControl.model}`)
      console.log(`  Sandbox Isolation:  ${t.sandboxIsolation.runtimeEngine}`)
      console.log(`  Network Policy:     ${t.sandboxIsolation.networkPolicy}`)
      console.log(`  Audit Ledger:       ${t.auditAndLogging.tamperEvidence}`)
      console.log(`  GDPR / Erasure:     ${t.dataPrivacyAndRetention.gdprCompliance}`)
      console.log(`───────────────────────────────────────────────────────────────────────────`)
      console.log(`💡 Run 'chatbolt security compliance' to view formal certification requirements.\n`)
      return res.data
    }

    if (action === 'audit') {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (userId) params.set('userId', userId)
      if (limit) params.set('limit', String(limit))

      const res = await client.request('GET', `/api/security/audit-logs?${params.toString()}`)
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const records = res.data.records || []
      console.log(`\n📜 Immutable Security Audit Ledger (${records.length} Events | Integrity: ${res.data.chainValid ? 'VERIFIED' : 'TAMPER_DETECTED'})`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      console.log(`  Seq   Category            Action                 Actor             Outcome`)
      console.log(`───────────────────────────────────────────────────────────────────────────`)
      for (const r of records) {
        const outColor = r.outcome === 'success' ? '\x1b[32mSUCCESS\x1b[0m' : '\x1b[31mDENIED\x1b[0m'
        console.log(`  #${String(r.sequenceNumber).padEnd(4)} ${r.category.padEnd(19)} ${r.action.padEnd(22)} ${String(r.userId).padEnd(17)} ${outColor}`)
      }
      console.log(`═══════════════════════════════════════════════════════════════════════════\n`)
      return res.data
    }

    if (action === 'export') {
      const res = await client.request('GET', `/api/security/audit-logs/export?format=${format}`)
      if (res.status >= 400) {
        throw new Error(`HTTP ${res.status}`)
      }

      if (format === 'csv') {
        console.log(res.data)
        return { success: true, csv: res.data }
      }

      console.log(JSON.stringify(res.data, null, 2))
      return res.data
    }

    if (action === 'compliance') {
      const res = await client.request('GET', '/api/security/compliance-status')
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const c = res.data.complianceStatus
      console.log(`\n📋 Enterprise Compliance Readiness & Non-Engineering Audit Roadmap`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      for (const [standard, details] of Object.entries(c.evaluatedStandards)) {
        const d = details as any
        console.log(`\n🏆 ${standard.toUpperCase().replace(/_/g, ' ')}: [${d.readinessStatus}]`)
        console.log(`  Implemented Technical Controls:`)
        for (const ctrl of d.implementedControls || []) {
          console.log(`    ✅ ${ctrl}`)
        }
        console.log(`  Required Non-Engineering Workstreams:`)
        for (const step of d.requiredNonEngineeringSteps || []) {
          console.log(`    ⏳ ${step}`)
        }
        if (d.estimatedBudgetUsd) {
          console.log(`  Estimated Budget:`)
          for (const [item, cost] of Object.entries(d.estimatedBudgetUsd)) {
            console.log(`    💰 ${item}: ${cost}`)
          }
        }
      }
      console.log(`\n⚖️  Transparency Pledge:`)
      console.log(`  "${c.transparencyPledge}"\n`)
      return res.data
    }

    if (action === 'inventory') {
      const res = await client.request('GET', '/api/security/data-inventory')
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const inv = res.data.inventory
      console.log(`\n📦 Customer Data Footprint & Inventory`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      console.log(`  Tenant ID:          ${inv.tenantId}`)
      console.log(`  Memory Chunks:      ${inv.memoryChunksCount} entries stored in PostgreSQL pgvector`)
      console.log(`  Active BYOK Keys:   ${inv.byokKeysConfigured.join(', ') || 'None'}`)
      console.log(`  Data Purge Status:  Available on-demand via GDPR API`)
      console.log(`═══════════════════════════════════════════════════════════════════════════\n`)
      return res.data
    }

    if (action === 'purge') {
      const res = await client.request('POST', '/api/security/data-purge', { scope })
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      console.log(`\n🗑️  GDPR Right to be Forgotten Purge Complete`)
      console.log(`  Scope:              ${res.data.purgedScope}`)
      console.log(`  Purged Items:       ${res.data.purgedItemsCount}`)
      console.log(`  Audit Log:          Recorded to immutable compliance ledger\n`)
      return res.data
    }

    throw new Error(`Unknown security action '${action}'`)
  } catch (err: any) {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`)
    if (json) {
      return { success: false, error: err.message }
    }
    throw err
  }
}
