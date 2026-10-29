import { useEffect, useState } from "react";
import {
  errorMessage,
  type Client,
  type FinancialRecord,
  type Member,
  type WorkspaceApi,
} from "@/lib/api";
import type { Tab } from "@/lib/navigation";

const SELF_MANAGED_TABS = new Set<Tab>([
  "overview",
  "access",
  "profile",
  "password",
  "expenses",
  "retainers",
  "employees",
  "workforce",
  "attendance",
  "leave",
  "overtime",
  "payroll",
  "payroll-automation",
  "cash-flow",
  "banking",
  "reports",
  "vendors",
  "accounts-payable",
]);
export function useWorkspaceRecords({
  api,
  tab,
  allowed,
  invoiceId,
  creatingInvoice,
}: {
  api: WorkspaceApi;
  tab: Tab;
  allowed: boolean;
  invoiceId?: string;
  creatingInvoice: boolean;
}) {
  const [previousTab, setPreviousTab] = useState(tab);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<(Client | Member | FinancialRecord)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (invoiceId || SELF_MANAGED_TABS.has(tab) || !allowed) return;
    const controller = new AbortController();
    api<(Client | Member | FinancialRecord)[]>(`/${tab}?limit=20&offset=${offset}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRows(data);
          setLoading(false);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(failure));
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [tab, offset, revision, api, allowed, creatingInvoice, invoiceId]);
  if (previousTab !== tab) {
    setPreviousTab(tab);
    setOffset(0);
    setRows([]);
    setError("");
    setLoading(true);
    setLoadFailed(false);
  }
  function reload() {
    setLoadFailed(false);
    setLoading(true);
    setError("");
    setRevision((current) => current + 1);
  }
  function previous() {
    setOffset((value) => value - 20);
    setLoading(true);
    setError("");
  }
  function next() {
    setOffset((value) => value + 20);
    setLoading(true);
    setError("");
  }
  return { rows, loading, error, setError, loadFailed, revision, offset, reload, previous, next };
}
