import dotenv from "dotenv";

dotenv.config();

const requiredVars = ["MONGODB_URI", "JWT_SECRET"] as const;

const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(", ")}. Set them in your .env file before starting the server.`,
  );
}

if ((process.env.JWT_SECRET as string).length < 32) {
  throw new Error(
    "JWT_SECRET is too weak. Use a random string of at least 32 characters.",
  );
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",

  PORT: process.env.PORT || "5000",

  MONGODB_URI: process.env.MONGODB_URI as string,

  JWT_SECRET: process.env.JWT_SECRET as string,

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",

  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",

  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
};

export default env;
