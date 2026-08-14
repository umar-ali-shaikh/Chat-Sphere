import { z } from "zod";

/**
 * Send Message Validation
 * `sender` is intentionally NOT accepted from the client — it is always
 * derived from the authenticated session to prevent identity spoofing.
 */
export const sendMessageSchema = z
  .object({
    chat: z.string().min(1, "Chat id is required"),
    receiver: z.string().min(1, "Receiver id is required"),
    text: z.string().trim().max(5000, "Message cannot exceed 5000 characters").optional(),
    image: z.string().trim().url("Image must be a valid URL").optional(),
    replyTo: z.string().trim().min(1).optional(),
  })
  .refine((data) => !!data.text || !!data.image, {
    message: "Message must contain text or an image",
    path: ["text"],
  });
