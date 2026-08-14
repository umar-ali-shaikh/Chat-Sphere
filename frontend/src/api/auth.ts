import { apiClient } from "@/lib/api-client";
import { normalizeUser, type AppUser, type RawUser, type ApiEnvelope } from "@/types/api";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<AppUser> {
    const { data } = await apiClient.post<ApiEnvelope<RawUser>>("/auth/register", input);
    return normalizeUser(data.data);
  },

  async login(input: LoginInput): Promise<AppUser> {
    const { data } = await apiClient.post<ApiEnvelope<RawUser>>("/auth/login", input);
    return normalizeUser(data.data);
  },

  async me(): Promise<AppUser> {
    const { data } = await apiClient.get<ApiEnvelope<RawUser>>("/auth/me");
    return normalizeUser(data.data);
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout");
  },
};
