import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { NotificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/response';

export class NotificationController {
  static async getUnread(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const notifications = await NotificationService.getUnread(
        req.user!.id,
        req.organizationId
      );
      
      // Map to frontend expected format
      const formatted = notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.content,
        time: n.createdAt.toISOString(),
        read: n.isRead,
        type: n.type
      }));
      
      return sendSuccess(res, formatted, 'Notifications fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const notification = await NotificationService.markAsRead(id, req.user!.id);
      return sendSuccess(res, notification, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }
}
