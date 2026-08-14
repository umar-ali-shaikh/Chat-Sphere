import mongoose, { Document, Schema, Types } from "mongoose";

export interface IChat extends Document {
  participants: Types.ObjectId[];
  pairKey?: string;
  lastMessage?: string;
  lastMessageAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // Deterministic key ("<smallerId>_<largerId>") for 1:1 chats only.
    // A unique+sparse index on this field is what actually enforces
    // "one private chat per pair" at the database level, closing the
    // race condition where two concurrent createChat calls could
    // otherwise both pass the findOne-then-create check.
    pairKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    lastMessage: {
      type: String,
      trim: true,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

chatSchema.pre("validate", function () {
  if (this.participants?.length === 2) {
    this.pairKey = this.participants
      .map((p) => p.toString())
      .sort()
      .join("_");
  }
});

chatSchema.index({ participants: 1 });

const Chat = mongoose.model<IChat>("Chat", chatSchema);

export default Chat;
