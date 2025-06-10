import express from 'express';
import { notifications, users } from '../../shared/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get user notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const { unreadOnly = false } = req.query;

    let query = req.db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    if (unreadOnly === 'true') {
      query = query.where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    }

    const userNotifications = await query;
    res.json(userNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Create notification
router.post('/', requireAuth, async (req, res) => {
  try {
    const { userId, type, title, message, data } = req.body;

    const newNotification = await req.db.insert(notifications).values({
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date(),
    }).returning();

    res.status(201).json(newNotification[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Mark notification as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;

    const updatedNotification = await req.db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();

    if (updatedNotification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(updatedNotification[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any).id;

    await req.db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;

    const deletedNotification = await req.db.delete(notifications)
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();

    if (deletedNotification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// System notification functions (for internal use)
export const createSystemNotification = async (db: any, userId: string, type: string, title: string, message: string, data?: any) => {
  try {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Error creating system notification:', error);
  }
};

export const createBulkNotifications = async (db: any, userIds: string[], type: string, title: string, message: string, data?: any) => {
  try {
    const notificationData = userIds.map(userId => ({
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date(),
    }));

    await db.insert(notifications).values(notificationData);
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
  }
};

export default router;