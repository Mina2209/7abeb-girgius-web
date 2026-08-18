import { apiGetJson } from './apiClient';

// Typed client for the admin-only UserActivity endpoints.
// All GET endpoints require an ADMIN token — the centralized apiClient attaches
// the Authorization header from localStorage, and the server enforces
// authenticate + requireAdmin. Never call these for public users.

interface ActivityUserRef {
  id: string;
  username: string;
  name: string;
  email: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  createdAt: string;
  route: string | null;
  visitorId: string | null;
  sessionId: string | null;
  userId: string | null;
  user: ActivityUserRef | null;
  visitorType: 'authenticated' | 'anonymous';
  contentType: string | null;
  contentId: string | null;
  contentName: string | null;
  metadata: Record<string, unknown> | null;
  deviceCategory: string | null;
  browserCategory: string | null;
}

export interface ActivityListParams {
  from?: string;
  to?: string;
  action?: string;
  userId?: string;
  contentType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ActivityListResult {
  items: ActivityItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ActivityOverview {
  totalActivities: number;
  authenticatedActivities: number;
  anonymousActivities: number;
  uniqueUsers: number;
  uniqueVisitors: number;
  from: string | null;
  to: string | null;
}

export interface ActivityUserItem {
  user: ActivityUserRef | null;
  activityCount: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
}

export interface ActivityUsersResult {
  items: ActivityUserItem[];
  anonymousCount: number;
  totalAuthenticatedUsers: number;
}

export interface ActivityActionItem {
  action: string;
  count: number;
}

function buildQuery(params?: ActivityListParams): string {
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export async function getActivity(params: ActivityListParams): Promise<ActivityListResult> {
  return apiGetJson<ActivityListResult>(`/api/admin/activity${buildQuery(params)}`);
}

export async function getActivityOverview(from?: string, to?: string): Promise<ActivityOverview> {
  return apiGetJson<ActivityOverview>(`/api/admin/activity/overview${buildQuery({ from, to })}`);
}

export async function getUsersActivity(params: ActivityListParams): Promise<ActivityUsersResult> {
  return apiGetJson<ActivityUsersResult>(`/api/admin/activity/users${buildQuery(params)}`);
}

export async function getActivityActions(from?: string, to?: string): Promise<ActivityActionItem[]> {
  return apiGetJson<ActivityActionItem[]>(`/api/admin/activity/actions${buildQuery({ from, to })}`);
}

async function getRecentActivity(limit = 25): Promise<ActivityItem[]> {
  return apiGetJson<ActivityItem[]>(`/api/admin/activity/recent${buildQuery({ limit })}`);
}
