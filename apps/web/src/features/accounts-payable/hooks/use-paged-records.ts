import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountsPayableApi } from "../types";
export interface RecordPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export type PageFilters = Record<string, string>;
export function usePagedRecords<T>(
  api: AccountsPayableApi,
  path: string,
  initialFilters: PageFilters = {},
  enabled = true,
) {
  const [query, setQuery] = useState({ filters: initialFilters, offset: 0, limit: 20 });
  const [page, setPage] = useState<RecordPage<T>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    request.current?.abort();
    if (!enabled) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      limit: String(query.limit),
      offset: String(query.offset),
    });
    for (const [key, value] of Object.entries(query.filters)) if (value) params.set(key, value);
    try {
      const next = await api<RecordPage<T>>(`${path}${path.includes("?") ? "&" : "?"}${params}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (query.offset > 0 && query.offset >= next.total) {
        setQuery((current) => ({
          ...current,
          offset: next.total ? Math.floor((next.total - 1) / query.limit) * query.limit : 0,
        }));
      } else setPage(next);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Could not load records.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [api, path, query, enabled]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void reload();
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [reload]);
  return {
    page,
    loading,
    error,
    reload,
    filters: query.filters,
    offset: query.offset,
    limit: query.limit,
    setFilters: (filters: PageFilters) =>
      setQuery((current) => ({ ...current, filters, offset: 0 })),
    setOffset: (offset: number) =>
      setQuery((current) => ({ ...current, offset: Math.max(0, offset) })),
    setLimit: (limit: number) => setQuery((current) => ({ ...current, limit, offset: 0 })),
  };
}
