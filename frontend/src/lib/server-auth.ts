import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { API_URL } from "@/lib/api-client";
import { normalizeUser, type AppUser, type RawUser } from "@/types/api";

export interface ServerSessionResult {
  user: AppUser | null;
  /**
   * `false` means the backend couldn't be reached / returned something
   * other than 200 or 401 — i.e. we genuinely don't know whether the
   * caller is authenticated. Route guards must NOT redirect to /login in
   * that case (a transient backend hiccup would otherwise force-log-out
   * every user on their next navigation); only a confirmed 401 counts as
   * "definitely unauthenticated".
   */
  checked: boolean;
}

/**
 * Server-only session check for route guards (`beforeLoad`). Reads the
 * httpOnly `token` cookie off the *incoming request to this frontend
 * server* (same-origin, sent automatically by the browser) and forwards it
 * by hand to the backend, which lives on a different origin and therefore
 * needs an explicit Cookie header rather than browser-managed credentials.
 *
 * Safe to call from client code too — `createServerFn` always executes this
 * on the server and the client gets an RPC call to it, so `getCookie` is
 * never evaluated in the browser.
 */
export const fetchServerUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServerSessionResult> => {
    const token = getCookie("token");
    if (!token) return { user: null, checked: true };

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Cookie: `token=${token}` },
      });

      if (res.status === 401) return { user: null, checked: true };
      if (!res.ok) return { user: null, checked: false };

      const body = (await res.json()) as { data: RawUser };
      return { user: normalizeUser(body.data), checked: true };
    } catch {
      return { user: null, checked: false };
    }
  },
);
