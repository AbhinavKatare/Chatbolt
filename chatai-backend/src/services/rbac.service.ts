/**
 * Role-Based Access Control (RBAC) Service
 * Enforces tenant-level authorization and permission matrices server-side.
 */

export type UserRole = 'owner' | 'admin' | 'operator' | 'auditor' | 'viewer'

export type Permission =
  | 'agents:create'
  | 'agents:deploy'
  | 'agents:delete'
  | 'agents:view'
  | 'actions:approve_destructive'
  | 'actions:reject_destructive'
  | 'audit:read'
  | 'audit:export'
  | 'cost:read'
  | 'cost:forecast'
  | 'billing:manage'
  | 'permissions:manage_standing_rules'
  | 'permissions:view_rules'
  | 'memory:read'
  | 'memory:write'
  | 'memory:delete'
  | 'security:view_trust_center'
  | 'security:manage_keys'
  | 'security:data_purge'

export interface UserContext {
  id: string
  email?: string
  tenantId: string
  role: UserRole
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'agents:create',
    'agents:deploy',
    'agents:delete',
    'agents:view',
    'actions:approve_destructive',
    'actions:reject_destructive',
    'audit:read',
    'audit:export',
    'cost:read',
    'cost:forecast',
    'billing:manage',
    'permissions:manage_standing_rules',
    'permissions:view_rules',
    'memory:read',
    'memory:write',
    'memory:delete',
    'security:view_trust_center',
    'security:manage_keys',
    'security:data_purge',
  ],
  admin: [
    'agents:create',
    'agents:deploy',
    'agents:delete',
    'agents:view',
    'actions:approve_destructive',
    'actions:reject_destructive',
    'audit:read',
    'audit:export',
    'cost:read',
    'cost:forecast',
    'billing:manage',
    'permissions:manage_standing_rules',
    'permissions:view_rules',
    'memory:read',
    'memory:write',
    'memory:delete',
    'security:view_trust_center',
    'security:manage_keys',
    'security:data_purge',
  ],
  operator: [
    'agents:create',
    'agents:deploy',
    'agents:view',
    'actions:reject_destructive',
    'cost:read',
    'cost:forecast',
    'permissions:view_rules',
    'memory:read',
    'memory:write',
    'security:view_trust_center',
  ],
  auditor: [
    'agents:view',
    'audit:read',
    'audit:export',
    'cost:read',
    'cost:forecast',
    'permissions:view_rules',
    'memory:read',
    'security:view_trust_center',
  ],
  viewer: [
    'agents:view',
    'cost:read',
    'permissions:view_rules',
    'memory:read',
    'security:view_trust_center',
  ],
}

export class RbacService {
  /**
   * Evaluates if a role has the required permission.
   */
  hasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role] || []
    return permissions.includes(permission)
  }

  /**
   * Evaluates if a user in a tenant context has all requested permissions.
   */
  hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(role, p))
  }

  /**
   * Evaluates if a user has at least one of the requested permissions.
   */
  hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(role, p))
  }

  /**
   * Resolves the list of all permissions for a given role.
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return [...(ROLE_PERMISSIONS[role] || [])]
  }

  /**
   * Returns the capability matrix for documentation and trust center display.
   */
  getRoleMatrix(): Record<UserRole, Permission[]> {
    return { ...ROLE_PERMISSIONS }
  }
}

export const rbacService = new RbacService()
