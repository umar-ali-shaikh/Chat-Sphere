import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/api-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * One socket for the whole app lifetime. Auth rides on the same httpOnly
 * cookie as REST (see backend/src/config/socket.ts), so there is no token
 * to pass by hand — `withCredentials` is enough.
 */
function getSocket(): AppSocket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectSocket(): AppSocket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function getSocketIfConnected(): AppSocket | null {
  return socket?.connected ? socket : null;
}

export { getSocket };
