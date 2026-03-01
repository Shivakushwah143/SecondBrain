import axios from 'axios';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const maybeMessage = (error.response?.data as { message?: string } | undefined)?.message;
    return maybeMessage || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};
