import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

import http from "http";
import mongoose from "mongoose";

import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";
import { initializeSocket } from "./config/socket.js";

async function startServer() {
  await connectDB();
  console.log("✅ Database Connected");

  const server = http.createServer(app);

  initializeSocket(server);

  server.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log("✅ MongoDB connection closed");
      } finally {
        process.exit(0);
      }
    });

    // Force-exit if shutdown hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

startServer();