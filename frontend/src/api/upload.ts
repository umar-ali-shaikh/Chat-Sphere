import { apiClient } from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

export interface UploadedImage {
  url: string;
  publicId: string;
}

export const uploadApi = {
  async image(file: File, onProgress?: (percent: number) => void): Promise<UploadedImage> {
    const form = new FormData();
    form.append("image", file);
    const { data } = await apiClient.post<ApiEnvelope<UploadedImage>>("/upload/image", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    return data.data;
  },

  async remove(publicId: string): Promise<void> {
    await apiClient.delete("/upload", { params: { publicId } });
  },
};
