"use client";

import { useRef, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { BankTransaction, ReconciliationCandidate } from "../types";

export function useBankReconciliation({
  api,
  reload,
  onSaved,
  onError,
}: {
  api: WorkspaceApi;
  reload: () => Promise<void>;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [transaction, setTransaction] = useState<BankTransaction | null>(null);
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const openVersion = useRef(0);

  async function open(row: BankTransaction) {
    const version = ++openVersion.current;
    setTransaction(row);
    setSelected("");
    setCandidates([]);
    try {
      const nextCandidates = await api<ReconciliationCandidate[]>(
        `/banking/transactions/${row.id}/suggestions`,
      );
      if (version === openVersion.current) setCandidates(nextCandidates);
    } catch (failure) {
      if (version === openVersion.current) onError(errorMessage(failure));
    }
  }

  async function reconcile() {
    const candidate = candidates.find((item) => item.targetId === selected);
    if (!transaction || !candidate) return;
    setBusy(true);
    try {
      await api(`/banking/transactions/${transaction.id}/reconcile`, {
        method: "POST",
        body: { targetType: candidate.targetType, targetId: candidate.targetId },
      });
      setTransaction(null);
      onSaved("Transaction reconciled.");
      await reload();
    } catch (failure) {
      onError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function reverse(row: BankTransaction) {
    if (
      !row.reconciliation ||
      !window.confirm("Reverse this reconciliation? The source payment will not be deleted.")
    )
      return;
    try {
      await api(`/banking/reconciliations/${row.reconciliation.id}/reverse`, {
        method: "POST",
        body: { expectedVersion: row.reconciliation.version, reason: "Reversed by user" },
      });
      onSaved("Reconciliation reversed.");
      await reload();
    } catch (failure) {
      onError(errorMessage(failure));
    }
  }

  return {
    transaction,
    candidates,
    selected,
    busy,
    setSelected,
    close: () => {
      openVersion.current++;
      setTransaction(null);
      setCandidates([]);
      setSelected("");
    },
    open,
    reconcile,
    reverse,
  };
}
