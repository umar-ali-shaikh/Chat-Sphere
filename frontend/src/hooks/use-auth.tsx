import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, type LoginInput, type RegisterInput } from "@/api/auth";
import { connectSocket, disconnectSocket } from "@/lib/socket-client";
import type { AppUser } from "@/types/api";

export const AUTH_ME_KEY = ["auth", "me"] as const;

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AppUser | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<AppUser>;
  register: (input: RegisterInput) => Promise<AppUser>;
  logout: () => Promise<void>;
  loginPending: boolean;
  registerPending: boolean;
  logoutPending: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Single source of truth for "who is logged in". Backed by GET /api/auth/me
 * (restores the session from the httpOnly cookie on every fresh load) and
 * kept in the TanStack Query cache so mutations elsewhere can just read
 * `["auth", "me"]` instead of prop-drilling the user.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const user = meQuery.data ?? null;
  const status: AuthStatus = meQuery.isLoading ? "loading" : user ? "authenticated" : "unauthenticated";

  // Socket auth rides on the same httpOnly cookie as REST — only open it
  // once we know a session exists, and tear it down the moment we don't.
  useEffect(() => {
    if (status === "authenticated") {
      connectSocket();
    } else if (status === "unauthenticated") {
      disconnectSocket();
    }
  }, [status]);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (loggedInUser) => {
      queryClient.setQueryData(AUTH_ME_KEY, loggedInUser);
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (newUser) => {
      queryClient.setQueryData(AUTH_ME_KEY, newUser);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      disconnectSocket();
      queryClient.setQueryData(AUTH_ME_KEY, null);
      queryClient.clear();
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login: (input) => loginMutation.mutateAsync(input),
      register: (input) => registerMutation.mutateAsync(input),
      logout: () => logoutMutation.mutateAsync(),
      loginPending: loginMutation.isPending,
      registerPending: registerMutation.isPending,
      logoutPending: logoutMutation.isPending,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, status, loginMutation.isPending, registerMutation.isPending, logoutMutation.isPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
