"use client";

import { useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { FinancialReport } from "../types";

export function useFinancialReport(api: WorkspaceApi, query: string, valid: boolean) {
  const [state, setState] = useState<{
    query: string;
    report: FinancialReport | null;
    error: string;
    loading: boolean;
  }>({ query: "", report: null, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (valid) {
      void Promise.resolve().then(async () => {
        if (controller.signal.aborted) return;
        setState({ query, report: null, error: "", loading: true });
        try {
          const report = await api<FinancialReport>(`/financial-reports/overview?${query}`, {
            signal: controller.signal,
          });
          if (!controller.signal.aborted) setState({ query, report, error: "", loading: false });
        } catch (failure) {
          if (!controller.signal.aborted) {
            setState({ query, report: null, error: errorMessage(failure), loading: false });
          }
        }
      });
    }
    return () => controller.abort();
  }, [api, query, valid, revision]);
  const current = state.query === query && valid;
  return {
    report: current ? state.report : null,
    loading: valid && (!current || state.loading),
    error: current ? state.error : "",
    reload: () => setRevision((value) => value + 1),
  };
}
