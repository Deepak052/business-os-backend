import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { prisma } from '../utils/prisma';

export class SubscriptionController {
  static async getCurrent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: { organizationId: req.organizationId!, status: 'active' },
        include: {
          plan: {
            include: { entitlements: { include: { module: true } } }
          }
        }
      });
      return sendSuccess(res, subscription, 'Subscription retrieved');
    } catch (error) { next(error); }
  }

  static async listPlans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        include: { entitlements: { include: { module: true } } }
      });
      return sendSuccess(res, plans, 'Plans retrieved');
    } catch (error) { next(error); }
  }
}
