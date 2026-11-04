"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { ExpensePage } from "../types";
import { expensePeriodRange } from "../utils";
import type { ExpenseFiltersValue } from "../components/expense-filters";

const INITIAL_FILTERS: ExpenseFiltersValue = {
  search: "",
  category: "",
  approvalStatus: "",
  settlementStatus: "",
  period: "",
  sort: "date",
  order: "desc",
};

export function useExpenseCollection(api: WorkspaceApi) {
  const [page, setPage] = useState<ExpensePage>({
    items: [],
    total: 0,
    pendingCount: 0,
    limit: 20,
    offset: 0,
  });
  const [limit, setLimitValue] = useState(20);
  const request = useRef<AbortController | null>(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [applied, setApplied] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailure("");
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      sort: applied.sort,
      order: applied.order,
    });
    for (const [key, value] of Object.entries(applied))
      if (value && !["sort", "order", "period"].includes(key)) query.set(key, value);
    const range = expensePeriodRange(applied.period);
    if (range) {
      query.set("from", range.from);
      query.set("to", range.to);
    }
    try {
      const next = await api<ExpensePage>(`/expenses?${query}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (offset > 0 && offset >= next.total)
        setOffset(next.total ? Math.floor((next.total - 1) / limit) * limit : 0);
      else setPage(next);
    } catch (error) {
      if (!controller.signal.aborted) setFailure(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [api, applied, offset, limit]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [load]);

  function applyFilters() {
    setOffset(0);
    setApplied(filters);
  }
  function showPending() {
    const next = { ...filters, approvalStatus: "PENDING_APPROVAL" };
    setFilters(next);
    setApplied(next);
    setOffset(0);
  }

  return {
    page,
    limit,
    setLimit: (value: number) => {
      setOffset(0);
      setLimitValue(value);
    },
    clearFilters: () => {
      setFilters(INITIAL_FILTERS);
      setApplied(INITIAL_FILTERS);
      setOffset(0);
    },
    offset,
    setOffset,
    filters,
    setFilters,
    applied,
    loading,
    failure,
    setFailure,
    load,
    applyFilters,
    showPending,
  };
}
