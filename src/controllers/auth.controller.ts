import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.register(req.body);
      return sendSuccess(res, user, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  static async registerInvited(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.registerInvited(req.body);
      return sendSuccess(res, user, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  static async validateInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      const { MembershipService } = require('../services/membership.service');
      const invitation = await MembershipService.validateInvitation(token);
      return sendSuccess(res, invitation, 'Invitation is valid');
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const deviceInfo = req.headers['user-agent'];
      const ipAddress = req.ip;

      const { token, user } = await AuthService.login(req.body, deviceInfo, ipAddress);

      // Set cookie (optional, depending on architecture)
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, { token, user }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.sessionId) {
        await AuthService.logout(req.user.sessionId);
      }
      
      res.clearCookie('token');
      return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { prisma } = require('../utils/prisma');
      const user = await prisma.user.findUnique({
        where: { id: req.user?.id },
        include: {
          memberships: {
            include: {
              organization: true,
              roles: {
                include: { 
                  role: {
                    include: {
                      permissions: {
                        include: { permission: true }
                      }
                    }
                  } 
                }
              }
            }
          }
        }
      });
      return sendSuccess(res, user, 'Current user');
    } catch (error) {
      next(error);
    }
  }

  static async getPermissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.organizationId) {
        return sendSuccess(res, [], 'Permissions');
      }
      const { RbacDelegationService } = require('../services/rbac-delegation.service');
      const { actions } = await RbacDelegationService.getEffectivePermissions(req.user!.id, req.organizationId);
      
      // Return array of objects with action property to match frontend expectations
      const formatted = Array.from(actions).map(action => ({ key: action, action }));
      return sendSuccess(res, formatted, 'Permissions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
