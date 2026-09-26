import crypto from 'crypto'
import { logger } from './logger.service'

export type AuditActionCategory =
  | 'agent_action'
  | 'human_approval'
  | 'permission_change'
  | 'data_access'
  | 'auth_event'
  | 'security_config_change'
  | 'data_purge'

export interface SecurityAuditRecord {
  id: string
  sequenceNumber: number
  tenantId: string
  userId: string
  userRole?: string
  category: AuditActionCategory
  action: string
  resourceType: string
  resourceId: string
  outcome: 'success' | 'failure' | 'denied' | 'pending'
  ipAddress?: string
  userAgent?: string
  details: Record<string, any>
  timestamp: string
  previousHash: string
  immutableHash: string
}

export interface AuditQueryFilter {
  tenantId?: string
  category?: AuditActionCategory
  userId?: string
  resourceType?: string
  outcome?: string
  fromTimestamp?: string
  toTimestamp?: string
  limit?: number
  offset?: number
}

export class SecurityAuditLoggerService {
  private auditLogLedger: SecurityAuditRecord[] = []
  private lastHash: string = 'GENESIS_BLOCK_CHATBOLT_ENTERPRISE_AUDIT_LEDGER'
  private sequenceCounter: number = 0

  constructor() {
    this.seedInitialSystemLogs()
  }

  private calculateHash(
    seq: number,
    prevHash: string,
    timestamp: string,
    tenantId: string,
    userId: string,
    action: string,
    details: any
  ): string {
    const raw = `${seq}:${prevHash}:${timestamp}:${tenantId}:${userId}:${action}:${JSON.stringify(details)}`
    return crypto.createHash('sha256').update(raw).digest('hex')
  }

  /**
   * Appends an immutable, cryptographically chained audit record.
   */
  logEvent(params: {
    tenantId: string
    userId: string
    userRole?: string
    category: AuditActionCategory
    action: string
    resourceType: string
    resourceId: string
    outcome?: 'success' | 'failure' | 'denied' | 'pending'
    ipAddress?: string
    userAgent?: string
    details?: Record<string, any>
  }): SecurityAuditRecord {
    this.sequenceCounter++
    const timestamp = new Date().toISOString()
    const outcome = params.outcome || 'success'
    const details = params.details || {}

    const immutableHash = this.calculateHash(
      this.sequenceCounter,
      this.lastHash,
      timestamp,
      params.tenantId,
      params.userId,
      params.action,
      details
    )

    const record: SecurityAuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sequenceNumber: this.sequenceCounter,
      tenantId: params.tenantId,
      userId: params.userId,
      userRole: params.userRole || 'owner',
      category: params.category,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      outcome,
      ipAddress: params.ipAddress || 'internal',
      userAgent: params.userAgent || 'Chatbolt/1.0',
      details,
      timestamp,
      previousHash: this.lastHash,
      immutableHash,
    }

    this.lastHash = immutableHash
    this.auditLogLedger.push(record)

    logger.info(
      `[Audit Log #${record.sequenceNumber}] [${record.category}] ${record.action} on ${record.resourceType}:${record.resourceId} by ${record.userId} (${record.outcome})`
    )

    return record
  }

  /**
   * Queries audit logs with pagination and filters.
   */
  queryLogs(filter: AuditQueryFilter = {}): {
    records: SecurityAuditRecord[]
    total: number
    chainValid: boolean
  } {
    let result = [...this.auditLogLedger]

    if (filter.tenantId) {
      result = result.filter((r) => r.tenantId === filter.tenantId)
    }
    if (filter.category) {
      result = result.filter((r) => r.category === filter.category)
    }
    if (filter.userId) {
      result = result.filter((r) => r.userId === filter.userId)
    }
    if (filter.resourceType) {
      result = result.filter((r) => r.resourceType === filter.resourceType)
    }
    if (filter.outcome) {
      result = result.filter((r) => r.outcome === filter.outcome)
    }
    if (filter.fromTimestamp) {
      const from = new Date(filter.fromTimestamp).getTime()
      result = result.filter((r) => new Date(r.timestamp).getTime() >= from)
    }
    if (filter.toTimestamp) {
      const to = new Date(filter.toTimestamp).getTime()
      result = result.filter((r) => new Date(r.timestamp).getTime() <= to)
    }

    const total = result.length
    const offset = filter.offset || 0
    const limit = filter.limit || 50
    const paged = result.slice(offset, offset + limit)

    return {
      records: paged,
      total,
      chainValid: this.verifyIntegrityChain(),
    }
  }

  /**
   * Verifies that the cryptographic hash chain of the entire audit log has not been tampered with.
   */
  verifyIntegrityChain(): boolean {
    let expectedPrevHash = 'GENESIS_BLOCK_CHATBOLT_ENTERPRISE_AUDIT_LEDGER'

    for (const record of this.auditLogLedger) {
      if (record.previousHash !== expectedPrevHash) {
        logger.error(`[Audit Tamper Alert] Hash mismatch at sequence #${record.sequenceNumber}`)
        return false
      }

      const recalculated = this.calculateHash(
        record.sequenceNumber,
        record.previousHash,
        record.timestamp,
        record.tenantId,
        record.userId,
        record.action,
        record.details
      )

      if (recalculated !== record.immutableHash) {
        logger.error(`[Audit Tamper Alert] Content corruption at sequence #${record.sequenceNumber}`)
        return false
      }

      expectedPrevHash = record.immutableHash
    }

    return true
  }

  /**
   * Exports audit log records as RFC-4180 compliant CSV.
   */
  exportToCsv(filter: AuditQueryFilter = {}): string {
    const { records } = this.queryLogs({ ...filter, limit: 10000, offset: 0 })

    const headers = [
      'Sequence',
      'Timestamp',
      'TenantId',
      'UserId',
      'UserRole',
      'Category',
      'Action',
      'ResourceType',
      'ResourceId',
      'Outcome',
      'IPAddress',
      'ImmutableHash',
      'DetailsJSON',
    ]

    const escapeCsv = (str: string) => {
      if (!str) return '""'
      const sanitized = String(str).replace(/"/g, '""')
      return `"${sanitized}"`
    }

    const rows = records.map((r) => [
      r.sequenceNumber,
      escapeCsv(r.timestamp),
      escapeCsv(r.tenantId),
      escapeCsv(r.userId),
      escapeCsv(r.userRole || ''),
      escapeCsv(r.category),
      escapeCsv(r.action),
      escapeCsv(r.resourceType),
      escapeCsv(r.resourceId),
      escapeCsv(r.outcome),
      escapeCsv(r.ipAddress || ''),
      escapeCsv(r.immutableHash),
      escapeCsv(JSON.stringify(r.details)),
    ])

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  }

  private seedInitialSystemLogs() {
    this.logEvent({
      tenantId: '00000000-0000-0000-0000-000000000000',
      userId: 'system_security_subsystem',
      userRole: 'owner',
      category: 'security_config_change',
      action: 'INITIALIZE_IMMUTABLE_AUDIT_LEDGER',
      resourceType: 'system_core',
      resourceId: 'audit_vault',
      outcome: 'success',
      details: {
        cipher: 'SHA-256 Chained',
        complianceReady: ['SOC2-CC6.1', 'SOC2-CC6.8', 'ISO27001-A.12.4.1'],
      },
    })
  }
}

export const securityAuditLoggerService = new SecurityAuditLoggerService()
