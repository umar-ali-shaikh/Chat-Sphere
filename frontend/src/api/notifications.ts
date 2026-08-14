import { apiClient } from "@/lib/api-client";
import { normalizeNotification, type AppNotification, type RawNotification, type ApiEnvelope } from "@/types/api";

export const notificationsApi = {
  async list(): Promise<AppNotification[]> {
    const { data } = await apiClient.get<ApiEnvelope<RawNotification[]>>("/notifications");
    return data.data.map(normalizeNotification);
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<ApiEnvelope<{ count: number }>>("/notifications/unread-count");
    return data.data.count;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiClient.patch("/notifications/read-all");
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },
};
