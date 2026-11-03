import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountsPayableApi } from "../types";
import { loadBillActivity } from "../services/bill-workflow-api";

export function useBillActivity(api: AccountsPayableApi, id: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadBillActivity>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const next = await loadBillActivity(api, id, controller.signal);
      if (!controller.signal.aborted) setData(next);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Could not load bill history.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [api, id]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [refresh]);
  return { data, loading, error, refresh };
}
