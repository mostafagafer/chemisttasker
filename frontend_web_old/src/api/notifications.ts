import apiClient from "../utils/apiClient";
import { API_ENDPOINTS } from "../constants/api";

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  action_url: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

type PaginatedResponse<T> = {
  results?: T[];
  unread?: number;
  count_unread?: number;
} & Record<string, unknown>;

export async function fetchNotifications(page = 1) {
  const { data } = await apiClient.get<PaginatedResponse<NotificationItem>>(
    `${API_ENDPOINTS.notifications}?page=${page}`
  );
  return data;
}

export async function markNotificationsRead(ids?: number[]) {
  const payload = ids ? { ids } : {};
  const { data } = await apiClient.post<{ marked: number; unread: number }>(
    API_ENDPOINTS.notificationsMarkRead,
    payload
  );
  return data;
}
