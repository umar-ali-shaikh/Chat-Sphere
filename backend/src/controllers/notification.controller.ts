import { Request, Response } from "express";
import * as notificationService from "../services/notification.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";

/**
 * GET /api/notifications
 * Get logged-in user's notifications
 */
export const getNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const notifications = await notificationService.getUserNotifications(userId);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  },
);

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
export const getUnreadCount = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: { count },
    });
  },
);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    if (!notificationId) {
      throw new AppError("Notification ID is required.", 400);
    }

    const notification = await notificationService.markNotificationAsRead(
      notificationId,
      userId,
    );

    if (!notification) {
      throw new AppError("Notification not found.", 404);
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: notification,
    });
  },
);

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    await notificationService.markAllNotificationsAsRead(userId);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  },
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    if (!notificationId) {
      throw new AppError("Notification ID is required.", 400);
    }

    await notificationService.deleteNotification(notificationId, userId);

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  },
);
