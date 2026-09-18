import { prisma } from '../config/database.js';
import type { AuthScope } from './access.service.js';

export async function listUserNotifications(auth: AuthScope) {
  const items = await prisma.userNotification.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  return { items, unread: items.filter((item) => !item.readAt).length };
}

export async function markUserNotificationRead(id: string, auth: AuthScope) {
  const item = await prisma.userNotification.findFirst({ where: { id, userId: auth.userId } });
  if (!item) return null;
  return prisma.userNotification.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllUserNotificationsRead(auth: AuthScope) {
  const result = await prisma.userNotification.updateMany({
    where: { userId: auth.userId, readAt: null },
    data: { readAt: new Date() }
  });
  return { count: result.count };
}
