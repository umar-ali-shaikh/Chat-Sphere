import { Router } from "express";
import {
  sendMessage,
  getMessages,
  searchMessages,
  markAsDelivered,
  markAsSeen,
  deleteMessage,
} from "../controllers/message.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { sendMessageSchema } from "../validations/message.validation.js";

const router = Router();

/**
 * @route   POST /api/messages
 * @desc    Send a new message
 * @access  Private
 */
router.post("/", protect, validate(sendMessageSchema), sendMessage);

/**
 * @route   GET /api/messages/:chatId
 * @desc    Get all messages of a chat
 * @access  Private
 */
router.get("/:chatId", protect, getMessages);

/**
 * @route   GET /api/messages/:chatId/search?q=text
 * @desc    Search messages within a chat
 * @access  Private
 */
router.get("/:chatId/search", protect, searchMessages);

/**
 * @route   PATCH /api/messages/:id/delivered
 * @desc    Mark message as delivered
 * @access  Private
 */
router.patch("/:id/delivered", protect, markAsDelivered);

/**
 * @route   PATCH /api/messages/:id/seen
 * @desc    Mark message as seen
 * @access  Private
 */
router.patch("/:id/seen", protect, markAsSeen);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message
 * @access  Private
 */
router.delete("/:id", protect, deleteMessage);

export default router;