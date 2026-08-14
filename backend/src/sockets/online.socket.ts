import { Socket } from "socket.io";
import { SocketData } from "../types/socket.js";
import { AppServer } from "../config/socket.js";
import User from "../models/User.js";

type AppSocket = Socket<any, any, any, SocketData>;

// Tracks every open socket per user (not just the latest one) so that a
// user with multiple tabs/devices connected isn't marked offline the
// moment any single one of them disconnects.
const onlineSockets = new Map<string, Set<string>>();

const registerOnlineSocket = (io: AppServer, socket: AppSocket): void => {
  const userId = socket.data.userId;

  const sockets = onlineSockets.get(userId) ?? new Set<string>();
  const wasOffline = sockets.size === 0;
  sockets.add(socket.id);
  onlineSockets.set(userId, sockets);

  if (wasOffline) {
    console.log(`🟢 ${userId} is online`);
    io.emit("user_online", { userId });

    User.findByIdAndUpdate(userId, { isOnline: true }).catch((error) =>
      console.error("Failed to persist online status:", error),
    );
  }

  io.emit("online_users", Array.from(onlineSockets.keys()));

  /**
   * Get Online Users
   */
  socket.on("get_online_users", () => {
    socket.emit("online_users", Array.from(onlineSockets.keys()));
  });

  /**
   * Disconnect — only mark the user offline once their last open socket
   * disconnects.
   */
  socket.on("disconnect", () => {
    const userSockets = onlineSockets.get(userId);

    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      onlineSockets.delete(userId);

      console.log(`🔴 ${userId} went offline`);

      io.emit("user_offline", { userId });
      io.emit("online_users", Array.from(onlineSockets.keys()));

      User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      }).catch((error) =>
        console.error("Failed to persist offline status:", error),
      );
    }
  });
};

export default registerOnlineSocket;
