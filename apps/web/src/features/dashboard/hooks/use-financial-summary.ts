"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { FinancialSummary } from "../types";

export function useFinancialSummary(api: WorkspaceApi, range: { from: string; to: string }) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
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
        setSummary(
          await api<FinancialSummary>(
            `/dashboard/financial-summary?from=${range.from}&to=${range.to}`,
            { signal: controller.signal },
          ),
        );
      } catch (failure) {
        if (!(failure instanceof Error && failure.name === "AbortError"))
          setError(errorMessage(failure));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [api, range.from, range.to, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { summary, loading, error, reload };
}
