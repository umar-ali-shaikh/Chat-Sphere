import { CookieOptions } from "express";
import env from "../config/env.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared cookie options for the auth token. Kept in one place because
 * clearCookie() must be called with the same httpOnly/secure/sameSite
 * options it was set with, or the browser silently keeps the cookie.
 *
 * sameSite is "none" in production because the deployed frontend and
 * backend live on different domains (e.g. vercel.app / onrender.com) —
 * a genuinely cross-site relationship, not just cross-port like local
 * dev. SameSite=Strict silently drops the cookie on every cross-site
 * request in that setup, breaking auth entirely. "none" requires
 * Secure, which is already true in production.
 */
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "strict",
};

export const authCookieOptionsWithExpiry: CookieOptions = {
  ...authCookieOptions,
  maxAge: SEVEN_DAYS_MS,
};
