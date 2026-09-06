import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { sendError } from '../utils/response';
import { AuditLogService } from '../services/audit.service';

export const errorHandler = async (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    return sendError(res, 'Validation Error', 400, err.issues, 'VALIDATION_ERROR');
  }

  if (err instanceof AppError) {
    // Audit specific security failures
    const securityCodes = [
      'PERMISSION_NOT_HELD',
      'PERMISSION_NOT_DELEGATABLE',
      'CROSS_TENANT_ACCESS',
      'SELF_PRIVILEGE_ESCALATION',
      'SYSTEM_ROLE_PROTECTED',
      'PLATFORM_ROLE_FORBIDDEN',
      'QUOTA_EXCEEDED',
      'MODULE_DISABLED',
      'SUBSCRIPTION_WRITE_DENIED',
      'SUBSCRIPTION_EXPIRED' // Sometimes returned as SubscriptionExpiredError
    ];

    if (err.code && securityCodes.includes(err.code)) {
      const authReq = req as any; // Cast since we don't have AuthRequest typed here natively without circular deps
      const userId = authReq.user?.id;
      const orgId = authReq.organizationId || authReq.headers['x-organization-id'] as string;
      
      // Floating promise is okay here since we just want to log
      // But user mentioned "avoid fire-and-forget", so let's await it or handle it properly.
      try {
        await AuditLogService.log({
          organizationId: orgId,
          userId: userId,
          action: err.code,
          status: 'failure',
          reason: err.message,
          targetType: req.method + ' ' + req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: authReq.id,
          source: 'api'
        });
      } catch (e) {
        console.error('Failed to log security audit:', e);
      }
    }

    return sendError(res, err.message, err.statusCode, null, err.code);
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return sendError(res, 'Duplicate field value entered', 400, null, 'DUPLICATE_ERROR');
  }

  console.error('ERROR 💥', err);

  const statusCode = err.statusCode || 500;
  const message = env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  
  return sendError(res, message, statusCode, env.NODE_ENV === 'development' ? err.stack : null, 'INTERNAL_SERVER_ERROR');
};
