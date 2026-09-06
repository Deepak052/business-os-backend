import { prisma } from '../utils/prisma';

export interface AuditLogFilters {
  organizationId?: string;
  userId?: string;
  action?: string;
  status?: string;
  requestId?: string;
  targetId?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class AuditLogService {
  static sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(AuditLogService.sanitize);

    const sensitiveKeys = ['password', 'passwordhash', 'token', 'accesstoken', 'refreshtoken', 'invitationtoken', 'secret', 'apikey', 'authorization', 'cookie'];
    const sanitized = { ...obj };
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = AuditLogService.sanitize(sanitized[key]);
      }
    }
    return sanitized;
  }

  static async log(data: {
    organizationId?: string;
    userId?: string;
    action: string;
    status: 'success' | 'failure';
    reason?: string;
    targetId?: string;
    targetType?: string;
    previousState?: any;
    newState?: any;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    source?: string;
  }, tx?: any) {
    const { getRequestContext } = require('../utils/request-context');
    const ctx = getRequestContext();
    const db = tx || prisma;
    
    const previousState = AuditLogService.sanitize(data.previousState);
    const newState = AuditLogService.sanitize(data.newState);

    // Audit logs are append-only.
    return db.auditLog.create({
      data: {
        organizationId: data.organizationId || ctx.organizationId,
        userId: data.userId || ctx.userId,
        action: data.action,
        status: data.status,
        reason: data.reason,
        targetId: data.targetId,
        targetType: data.targetType,
        previousState: previousState,
        newState: newState,
        ipAddress: data.ipAddress || ctx.ipAddress,
        userAgent: data.userAgent || ctx.userAgent,
        requestId: data.requestId || ctx.requestId,
        source: data.source || 'api',
      },
    });
  }

  static async getLogs(filters: AuditLogFilters) {
    const { page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.status) where.status = filters.status;
    if (filters.requestId) where.requestId = filters.requestId;
    if (filters.targetId) where.targetId = filters.targetId;
    if (filters.targetType) where.targetType = filters.targetType;
    
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
