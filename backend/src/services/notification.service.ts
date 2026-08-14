import Notification, {
  INotification,
} from "../models/Notification.js";

/**
 * Create Notification
 */
export const createNotification = async (
  data: Partial<INotification>
): Promise<INotification> => {
  return await Notification.create(data);
};

/**
 * Get User Notifications
 */
export const getUserNotifications = async (
  userId: string,
  limit = 30,
  before?: Date,
): Promise<INotification[]> => {
  const filter: Record<string, unknown> = { recipient: userId };

  if (before) {
    filter.createdAt = { $lt: before };
  }

  return await Notification.find(filter)
    .populate("sender", "name avatar")
    .populate("chat", "participants lastMessage lastMessageAt")
    .populate("message", "text image status")
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100));
};

/**
 * Mark Notification as Read
 * Only the recipient may mark their own notification as read.
 */
export const markNotificationAsRead = async (
  notificationId: string,
  userId: string,
): Promise<INotification | null> => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    {
      isRead: true,
      readAt: new Date(),
    },
    {
      new: true,
    }
  );
};

/**
 * Mark All Notifications as Read
 */
export const markAllNotificationsAsRead = async (
  userId: string
): Promise<void> => {
  await Notification.updateMany(
    {
      recipient: userId,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );
};

/**
 * Delete Notification
 * Only the recipient may delete their own notification.
 */
export const deleteNotification = async (
  notificationId: string,
  userId: string,
): Promise<void> => {
  await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });
};

/**
 * Get Unread Notification Count
 */
export const getUnreadCount = async (
  userId: string
): Promise<number> => {
  return await Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });
};