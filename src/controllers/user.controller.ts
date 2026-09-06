import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { prisma } from '../utils/prisma';

export class UserController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const search = req.query.search as string;

      const where: any = {
        memberships: {
          some: { organizationId: req.organizationId! }
        }
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            memberships: {
              where: { organizationId: req.organizationId! },
              include: { roles: { include: { role: true } } }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      return sendSuccess(res, { data: users, meta: { total, page, limit } }, 'Users retrieved');
    } catch (error) { next(error); }
  }

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          id: req.params.id as string,
          memberships: { some: { organizationId: req.organizationId! } }
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          memberships: {
            where: { organizationId: req.organizationId! },
            include: { roles: { include: { role: true } } }
          }
        }
      });
      if (!user) return sendError(res, 'User not found', 404);
      return sendSuccess(res, user, 'User retrieved');
    } catch (error) { next(error); }
  }
}
