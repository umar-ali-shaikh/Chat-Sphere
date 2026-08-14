import { apiClient } from "@/lib/api-client";
import { normalizeMessage, type AppMessage, type RawMessage, type ApiEnvelope } from "@/types/api";

export interface GetMessagesOptions {
  limit?: number | undefined;
  before?: string | undefined;
}

export const messagesApi = {
  async list(chatId: string, options: GetMessagesOptions = {}): Promise<AppMessage[]> {
    const { data } = await apiClient.get<ApiEnvelope<RawMessage[]>>(`/messages/${chatId}`, {
      params: options,
    });
    return data.data.map(normalizeMessage);
  },

  async remove(messageId: string): Promise<void> {
    await apiClient.delete(`/messages/${messageId}`);
  },

  async search(chatId: string, query: string): Promise<AppMessage[]> {
    const { data } = await apiClient.get<ApiEnvelope<RawMessage[]>>(`/messages/${chatId}/search`, {
      params: { q: query },
    });
    return data.data.map(normalizeMessage);
  },
};
