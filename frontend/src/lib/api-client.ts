import axios, { AxiosError } from "axios";

/**
 * Base origin of the ChatSphere backend. REST lives under `${API_URL}/api`,
 * Socket.IO connects directly to `${API_URL}`.
 */
export const API_URL = import.meta.env["VITE_API_URL"] || "http://localhost:5000";

export class ApiError extends Error {
  status?: number | undefined;

  constructor(message: string, status?: number | undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

interface BackendErrorBody {
  success: false;
  message?: string;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<BackendErrorBody>) => {
    if (error.response) {
      const message = error.response.data?.message || "Something went wrong. Please try again.";
      return Promise.reject(new ApiError(message, error.response.status));
    }
    if (error.request) {
      return Promise.reject(new ApiError("Can't reach the server. Check your connection and try again."));
    }
    return Promise.reject(new ApiError(error.message));
  },
);

export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
