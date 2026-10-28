"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { ExpensePage } from "../types";
import { expensePeriodRange } from "../utils";
import type { ExpenseFiltersValue } from "../components/expense-filters";

const INITIAL_FILTERS: ExpenseFiltersValue = {
  search: "",
  category: "",
  approvalStatus: "",
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
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [applied, setApplied] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFailure("");
    const query = new URLSearchParams({
      limit: "20",
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
      setPage(await api<ExpensePage>(`/expenses?${query}`));
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [api, applied, offset]);

  useEffect(() => {
    // Loading is intentionally tied to the applied filters and page offset.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
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
