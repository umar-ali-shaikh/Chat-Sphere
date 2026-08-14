import { apiClient } from "@/lib/api-client";
import { normalizeChat, type AppChat, type RawChat, type ApiEnvelope } from "@/types/api";

export const chatsApi = {
  async list(): Promise<AppChat[]> {
    const { data } = await apiClient.get<ApiEnvelope<RawChat[]>>("/chat");
    return data.data.map(normalizeChat);
  },

  async getById(chatId: string): Promise<AppChat> {
    const { data } = await apiClient.get<ApiEnvelope<RawChat>>(`/chat/${chatId}`);
    return normalizeChat(data.data);
  },

  async create(receiverId: string): Promise<AppChat> {
    const { data } = await apiClient.post<ApiEnvelope<RawChat>>("/chat", { receiverId });
    return normalizeChat(data.data);
  },

  async remove(chatId: string): Promise<void> {
    await apiClient.delete(`/chat/${chatId}`);
  },
};
