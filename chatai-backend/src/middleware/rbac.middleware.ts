import { Request, Response, NextFunction } from 'express'
import { rbacService, Permission, UserRole } from '../services/rbac.service'
import { logger } from '../services/logger.service'

export interface AuthenticatedUser {
  id: string
  email?: string
  role: UserRole
  tenantId: string
  [key: string]: any
}

declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole
      authUser?: AuthenticatedUser
    }
  }
}

/**
 * Extracts and normalizes the user's role in the current tenant.
 * Defaults to 'owner' for single-tenant / local mode, or extracts role from req.user/tenant.
 */
export function resolveUserRole(req: Request): UserRole {
  const user = (req as any).user
  if (user?.role && ['owner', 'admin', 'operator', 'auditor', 'viewer'].includes(user.role)) {
    return user.role as UserRole
  }
  if (req.headers['x-user-role']) {
    const headerRole = String(req.headers['x-user-role']).toLowerCase()
    if (['owner', 'admin', 'operator', 'auditor', 'viewer'].includes(headerRole)) {
      return headerRole as UserRole
    }
  }
  // Default tenant owner
  return 'owner'
}

/**
 * Middleware that enforces a specific permission server-side.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = resolveUserRole(req)
    req.userRole = role

    if (!rbacService.hasPermission(role, permission)) {
      logger.warn(
        `[RBAC Denied] Tenant: ${req.tenantId || 'unknown'} | Role: ${role} | Lacks permission: ${permission} | Path: ${req.originalUrl}`
      )
      return res.status(403).json({
        error: `Forbidden: Role '${role}' does not have required permission '${permission}'`,
        requiredPermission: permission,
        currentRole: role,
      })
    }

    next()
  }
}

/**
 * Middleware that enforces that the user has at least one of the specified roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = resolveUserRole(req)
    req.userRole = role

    if (!allowedRoles.includes(role)) {
      logger.warn(
        `[RBAC Role Denied] Tenant: ${req.tenantId || 'unknown'} | Role: ${role} | Required: ${allowedRoles.join(', ')} | Path: ${req.originalUrl}`
      )
      return res.status(403).json({
        error: `Forbidden: Role '${role}' is not authorized to access this resource`,
        allowedRoles,
        currentRole: role,
      })
    }

    next()
  }
}
