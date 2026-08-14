import { apiClient } from "@/lib/api-client";
import { normalizeUser, type AppUser, type RawUser, type ApiEnvelope } from "@/types/api";

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const usersApi = {
  async search(query?: string): Promise<AppUser[]> {
    const { data } = await apiClient.get<ApiEnvelope<RawUser[]>>("/user", {
      params: query ? { q: query } : undefined,
    });
    return data.data.map(normalizeUser);
  },

  async getProfile(): Promise<AppUser> {
    const { data } = await apiClient.get<ApiEnvelope<RawUser>>("/user/profile");
    return normalizeUser(data.data);
  },

  async updateProfile(input: UpdateProfileInput): Promise<AppUser> {
    const { data } = await apiClient.put<ApiEnvelope<RawUser>>("/user/profile", input);
    return normalizeUser(data.data);
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await apiClient.put("/user/change-password", input);
  },

  async uploadAvatar(file: File): Promise<AppUser> {
    const form = new FormData();
    form.append("avatar", file);
    const { data } = await apiClient.post<ApiEnvelope<RawUser>>("/user/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return normalizeUser(data.data);
  },
};
