import { API_BASE_URL } from "@/lib/config";
import { getStoredAuth } from "@/lib/auth";

type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { skipAuth, headers, ...rest } = options;
  const url = `${API_BASE_URL}${path}`;
  const auth = skipAuth ? null : getStoredAuth();
  const response = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(auth?.token ? { token: auth.token } : {}),
      ...(headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type");
  const hasJson = contentType?.includes("application/json");
  const payload = hasJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (payload && (payload.message as string)) ||
      `Error ${response.status}: ${response.statusText}`;
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return payload as T;
}

export function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && "data" in payload) {
    const typed = payload as { data?: T[] };
    return Array.isArray(typed.data) ? typed.data : [];
  }
  if (payload && typeof payload === "object" && "items" in payload) {
    const typed = payload as { items?: T[] };
    return Array.isArray(typed.items) ? typed.items : [];
  }
  return [];
}

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

export function extractPagination(payload: unknown): PaginationMeta | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const page = Number(data.page ?? data.currentPage ?? 1);
  const limit = Number(data.limit ?? data.pageSize ?? 10);
  const total = Number(data.total ?? data.totalCount ?? 0);
  const pageCount = Number(data.pageCount ?? data.totalPages ?? 1);
  if (Number.isNaN(page) || Number.isNaN(limit)) return null;
  return { page, limit, total, pageCount };
}
