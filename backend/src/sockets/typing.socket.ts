import { Socket } from "socket.io";
import { SocketData } from "../types/socket.js";
import { AppServer } from "../config/socket.js";

type AppSocket = Socket<any, any, any, SocketData>;

const registerTypingSocket = (_io: AppServer, socket: AppSocket): void => {
  const userId = socket.data.userId;

  /**
   * User starts typing
   * The userId broadcast is always the authenticated socket's own id —
   * never a client-supplied value — so a user can't fake a typing
   * indicator for someone else.
   */
  socket.on("typing", (chatId: string) => {
    socket.to(chatId).emit("typing", {
      chatId,
      userId,
    });
  });

  /**
   * User stops typing
   */
  socket.on("stop_typing", (chatId: string) => {
    socket.to(chatId).emit("stop_typing", {
      chatId,
      userId,
    });
  });
};

export default registerTypingSocket;
