"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { FinancialSummary } from "../types";

export function useFinancialSummary(api: WorkspaceApi, range: { from: string; to: string }) {
  const [stored, setSummary] = useState<{ from: string; to: string; data: FinancialSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
      try {
        const result = await api<FinancialSummary>(
          `/dashboard/financial-summary?from=${range.from}&to=${range.to}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setSummary({ from: range.from, to: range.to, data: result });
      } catch (failure) {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [api, range.from, range.to, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const current = stored?.from === range.from && stored?.to === range.to;
  return { summary: current ? stored.data : null, loading: loading || (!current && !error), error, reload };
}
