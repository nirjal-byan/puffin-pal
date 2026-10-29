import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { PayrollDetails, PayrollRun, WorkforceReview } from "../types";

export function usePayrollRuns(api: WorkspaceApi) {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selected, setSelected] = useState<PayrollDetails | null>(null);
  const [workforceReview, setWorkforceReview] = useState<WorkforceReview[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const data = await api<{ items: PayrollRun[] }>("/payroll/runs?limit=100&offset=0");
    setRuns(data.items);
  }, [api]);
  const open = useCallback(
    async (run: PayrollRun) => {
      try {
        const [details, review] = await Promise.all([
          api<PayrollDetails>(`/payroll/runs/${run.id}`),
          api<WorkforceReview[]>(`/payroll/runs/${run.id}/workforce-review`),
        ]);
        setSelected(details);
        setWorkforceReview(review);
      } catch (failure) {
        setError(errorMessage(failure));
      }
    },
    [api],
  );
  useEffect(() => {
    let active = true;
    api<{ items: PayrollRun[] }>("/payroll/runs?limit=100&offset=0")
      .then((data) => {
        if (active) setRuns(data.items);
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api]);
  return { runs, selected, setSelected, workforceReview, error, setError, load, open };
}
