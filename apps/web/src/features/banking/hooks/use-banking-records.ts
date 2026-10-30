"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { BankAccount, BankImport, BankTransaction, PaymentBatch } from "../types";

export function useBankingRecords(api: WorkspaceApi) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [imports, setImports] = useState<BankImport[]>([]);
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [importAccount, setImportAccount] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const loadVersion = useRef(0);
  const invalidateLoads = useCallback(() => {
    loadVersion.current++;
  }, []);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const [nextAccounts, nextTransactions, nextImports, nextBatches] = await Promise.all([
        api<BankAccount[]>("/banking/accounts"),
        api<BankTransaction[]>("/banking/transactions?limit=100&offset=0"),
        api<BankImport[]>("/banking/imports?limit=50&offset=0"),
        api<PaymentBatch[]>("/banking/payment-batches"),
      ]);
      if (version !== loadVersion.current) return;
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setImports(nextImports);
      setBatches(nextBatches);
      setImportAccount(
        (current) =>
          current || nextAccounts.find((item) => item.isDefault)?.id || nextAccounts[0]?.id || "",
      );
    } catch (failure) {
      if (version === loadVersion.current) setError(errorMessage(failure));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => {
      window.cancelAnimationFrame(frame);
      invalidateLoads();
    };
  }, [invalidateLoads, load]);

  const accountById = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts]);
  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((row) => {
      const statusMatches =
        status === "ALL" || (status === "MATCHED" ? row.reconciliation : !row.reconciliation);
      const accountName = accountById.get(row.bankAccountId)?.displayName.toLowerCase() ?? "";
      return Boolean(
        statusMatches &&
        (!query ||
          row.description.toLowerCase().includes(query) ||
          row.reference?.toLowerCase().includes(query) ||
          accountName.includes(query)),
      );
    });
  }, [accountById, search, status, transactions]);

  return {
    accounts,
    transactions,
    imports,
    batches,
    importAccount,
    setImportAccount,
    search,
    setSearch,
    status,
    setStatus,
    error,
    setError,
    loading,
    load,
    accountById,
    visibleTransactions,
  };
}
