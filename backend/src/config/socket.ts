import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";

import env from "./env.js";
import User from "../models/User.js";
import registerChatSocket from "../sockets/chat.socket.js";
import registerTypingSocket from "../sockets/typing.socket.js";
import registerOnlineSocket from "../sockets/online.socket.js";
import { SocketData } from "../types/socket.js";

export type AppServer = Server<any, any, any, SocketData>;

let io: AppServer;

interface TokenPayload extends JwtPayload {
  userId: string;
}

/**
 * Extracts the `token` cookie from a raw handshake Cookie header without
 * pulling in an extra dependency (equivalent to what cookie-parser does
 * for HTTP requests, but Socket.IO handshakes aren't run through Express
 * middleware).
 */
const extractTokenFromCookieHeader = (
  cookieHeader: string | undefined,
): string | null => {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === "token") {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
};

/**
 * Initialize Socket.IO
 */
export const initializeSocket = (server: HttpServer): AppServer => {
  io = new Server<any, any, any, SocketData>(server, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Every socket must present the same httpOnly JWT cookie used for REST
  // auth. Without this, any client could claim to be any userId simply by
  // emitting events with a spoofed id — there is no other proof of identity
  // over the socket transport.
  io.use(async (socket, next) => {
    try {
      const token = extractTokenFromCookieHeader(socket.handshake.headers.cookie);

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

      const user = await User.findById(decoded.userId).select("_id");

      if (!user) {
        return next(new Error("Authentication failed"));
      }

      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    console.log(`🟢 User Connected: ${socket.id} (user ${userId})`);

    // Personal room for direct notifications — joined automatically from
    // the verified identity rather than trusting a client-emitted "join".
    socket.join(userId);

    registerChatSocket(io, socket);
    registerTypingSocket(io, socket);
    registerOnlineSocket(io, socket);

    socket.on("disconnect", () => {
      console.log(`🔴 User Disconnected: ${socket.id} (user ${userId})`);
    });
  });

  return io;
};

/**
 * Get Socket.IO instance
 */
export const getIO = (): AppServer => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
};
