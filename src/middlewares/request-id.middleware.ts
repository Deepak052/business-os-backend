import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthRequest } from './auth.middleware';
import { requestContext } from '../utils/request-context';

export const requestIdMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const incomingId = req.headers['x-request-id'];
  let requestId: string;

  // Validate basic UUID format if provided, otherwise generate one
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (typeof incomingId === 'string' && uuidRegex.test(incomingId)) {
    requestId = incomingId;
  } else {
    requestId = crypto.randomUUID();
  }

  // Extend Express Request object
  req.id = requestId;

  // Append to response header
  res.setHeader('X-Request-Id', requestId);

  // Initialize async context
  requestContext.run({
    requestId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  }, () => {
    next();
  });
};
