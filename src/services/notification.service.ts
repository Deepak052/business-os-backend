import { prisma } from '../utils/prisma';
import { NotFoundError } from '../utils/errors';

export class NotificationService {
  static async createNotification(data: {
    userId: string;
    organizationId?: string;
    type: string;
    title: string;
    content: string;
    link?: string;
  }) {
    // 1. Fetch user preferences
    const pref = await prisma.notificationPreference.findUnique({
      where: {
        userId_organizationId: {
          userId: data.userId,
          organizationId: data.organizationId || '', // Note: prisma requires null handling if it's unique compound
        }
      }
    });

    // 2. Check if this type of notification is disabled by preference
    if (pref && pref.types && typeof pref.types === 'object') {
      if ((pref.types as any)[data.type] === false) {
        return null; // Opted out
      }
    }

    // 3. Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        type: data.type,
        title: data.title,
        content: data.content,
        link: data.link,
      }
    });

    // 4. (Future) Trigger external providers (Email, Push) based on pref.channels

    return notification;
  }

  static async getUnread(userId: string, organizationId?: string) {
    return prisma.notification.findMany({
      where: {
        userId,
        organizationId,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async markAsRead(id: string, userId: string) {
    const notif = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!notif) throw new NotFoundError('Notification not found');

    return prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
  }
}
