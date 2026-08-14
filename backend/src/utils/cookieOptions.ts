import { CookieOptions } from "express";
import env from "../config/env.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared cookie options for the auth token. Kept in one place because
 * clearCookie() must be called with the same httpOnly/secure/sameSite
 * options it was set with, or the browser silently keeps the cookie.
 */
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
};

export const authCookieOptionsWithExpiry: CookieOptions = {
  ...authCookieOptions,
  maxAge: SEVEN_DAYS_MS,
};
