import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  id?: string;
  user?: {
    id: string;
    sessionId: string;
  };
  organizationId?: string; // Set by tenant middleware
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token = '';
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError('Not logged in');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; sessionId: string };
    
    // Server-side session verification
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true }
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Session is invalid or has expired');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    req.user = { id: session.userId, sessionId: session.id };
    
    const { getRequestContext } = require('../utils/request-context');
    const ctx = getRequestContext();
    if (ctx) ctx.userId = session.userId;

    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};
