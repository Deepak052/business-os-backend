export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

// Subscriptions & Quotas
export class QuotaExceededError extends AppError {
  constructor(message = 'QUOTA_EXCEEDED') {
    super(message, 403, 'QUOTA_EXCEEDED');
  }
}

export class ModuleDisabledError extends AppError {
  constructor(message = 'MODULE_DISABLED') {
    super(message, 403, 'MODULE_DISABLED');
  }
}

export class SubscriptionExpiredError extends AppError {
  constructor(message = 'SUBSCRIPTION_EXPIRED') {
    super(message, 403, 'SUBSCRIPTION_EXPIRED');
  }
}

// RBAC & Security (Gate 6)
export class PermissionNotDelegatableError extends ForbiddenError {
  constructor(message = 'Permission is not delegatable.') {
    super(message, 'PERMISSION_NOT_DELEGATABLE');
  }
}

export class PermissionNotHeldError extends ForbiddenError {
  constructor(message = 'You do not have authority to delegate this permission.') {
    super(message, 'PERMISSION_NOT_HELD');
  }
}

export class CrossTenantAccessError extends ForbiddenError {
  constructor(message = 'Cross-tenant resource access is forbidden.') {
    super(message, 'CROSS_TENANT_ACCESS');
  }
}

export class SystemRoleProtectedError extends ForbiddenError {
  constructor(message = 'System role modification is protected.') {
    super(message, 'SYSTEM_ROLE_PROTECTED');
  }
}

export class PlatformRoleForbiddenError extends ForbiddenError {
  constructor(message = 'Platform role access from tenant is forbidden.') {
    super(message, 'PLATFORM_ROLE_FORBIDDEN');
  }
}

export class SelfPrivilegeEscalationError extends ForbiddenError {
  constructor(message = 'You cannot escalate your own privileges.') {
    super(message, 'SELF_PRIVILEGE_ESCALATION');
  }
}

export class RoleInUseError extends ConflictError {
  constructor(message = 'Role is already assigned and in use.') {
    super(message, 'ROLE_IN_USE');
  }
}

export class RoleInactiveError extends ForbiddenError {
  constructor(message = 'Role is inactive.') {
    super(message, 'ROLE_INACTIVE');
  }
}

export class PermissionInactiveError extends ForbiddenError {
  constructor(message = 'Permission is inactive or disabled.') {
    super(message, 'PERMISSION_INACTIVE');
  }
}

export class InsufficientAuthorityError extends ForbiddenError {
  constructor(message = 'Insufficient authority.') {
    super(message, 'INSUFFICIENT_AUTHORITY');
  }
}

