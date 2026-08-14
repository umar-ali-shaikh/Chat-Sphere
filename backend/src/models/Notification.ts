import { Schema, model, Document, Types } from "mongoose";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  sender: Types.ObjectId;
  chat: Types.ObjectId;
  message?: Types.ObjectId;

  type: "message" | "image";

  title: string;
  body: string;

  isRead: boolean;
  readAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },

    message: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },

    type: {
      type: String,
      enum: ["message", "image"],
      default: "message",
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    body: {
      type: String,
      required: true,
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1 });

export default model<INotification>(
  "Notification",
  notificationSchema
);