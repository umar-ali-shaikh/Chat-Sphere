import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  receiver: Types.ObjectId;

  text?: string;
  image?: string;
  replyTo?: Types.ObjectId;

  status: "sent" | "delivered" | "seen";

  seenAt?: Date;
  deliveredAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    deliveredAt: {
      type: Date,
    },

    seenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Powers the common "latest N messages in a chat, paginated by cursor" query
messageSchema.index({ chat: 1, createdAt: -1 });

export default model<IMessage>("Message", messageSchema);