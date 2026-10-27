"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import type { WorkspaceApi } from "@/lib/api";
import { errorMessage } from "@/lib/api";
import { DEFAULT_IMPORT_MAPPING as defaultMapping } from "./constants";
import type {
  BankAccount as Account,
  BankImport as ImportRow,
  BankImportPreview,
  BankingView,
  BankTransaction as Transaction,
  PaymentBatch as Batch,
  PaymentBatchItem as BatchItem,
  PayrollObligation as Obligation,
  ReconciliationCandidate as Candidate,
} from "./types";
import { BankAccountGrid } from "./bank-account-grid";
import { BankAccountDialog } from "./bank-account-dialog";
import { BankImportsTable } from "./bank-imports-table";
import { BankingToolbar } from "./banking-toolbar";
import { BankTransactionsTable } from "./bank-transactions-table";
import { ImportStatementDialog } from "./import-statement-dialog";
import { PaymentBatchDialog } from "./payment-batch-dialog";
import { PaymentBatchesPanel } from "./payment-batches-panel";
import { ReconciliationDialog } from "./reconciliation-dialog";

export default function BankingPage({
  api,
  permissions,
  onSaved,
}: {
  api: WorkspaceApi;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}) {
  const canManage = permissions.includes("banking:manage");
  const canReconcile = permissions.includes("banking:reconcile");
  const [view, setView] = useState<BankingView>("transactions");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accountModal, setAccountModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [matching, setMatching] = useState<Transaction | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState({
    displayName: "",
    bankName: "",
    accountHolder: "",
    maskedIdentifier: "",
    currency: "USD",
    countryCode: "US",
    isActive: true,
    isDefault: false,
  });
  const [importAccount, setImportAccount] = useState("");
  const [csv, setCsv] = useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = useState<BankImportPreview | null>(null);
  const [importMapping, setImportMapping] = useState(defaultMapping);
  const [batchName, setBatchName] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextAccounts, nextTransactions, nextImports, nextBatches] = await Promise.all([
        api<Account[]>("/banking/accounts"),
        api<Transaction[]>("/banking/transactions?limit=100&offset=0"),
        api<ImportRow[]>("/banking/imports?limit=50&offset=0"),
        api<Batch[]>("/banking/payment-batches"),
      ]);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setImports(nextImports);
      setBatches(nextBatches);
      setImportAccount(
        (current) =>
          current || nextAccounts.find((item) => item.isDefault)?.id || nextAccounts[0]?.id || "",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const accountById = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts]);
  const visibleTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();
    return transactions.filter((row) => {
      const statusMatches =
        transactionStatus === "ALL" ||
        (transactionStatus === "MATCHED" ? Boolean(row.reconciliation) : !row.reconciliation);
      const accountName = accountById.get(row.bankAccountId)?.displayName.toLowerCase() ?? "";
      const searchMatches =
        !query ||
        row.description.toLowerCase().includes(query) ||
        Boolean(row.reference?.toLowerCase().includes(query)) ||
        accountName.includes(query);
      return statusMatches && searchMatches;
    });
  }, [accountById, transactionSearch, transactionStatus, transactions]);
  async function saveAccount() {
    setBusy(true);
    try {
      await api("/banking/accounts", { method: "POST", body: account });
      setAccountModal(false);
      onSaved("Bank account added.");
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function previewCsv() {
    if (!csv || !importAccount) return;
    setBusy(true);
    try {
      setPreview(
        await api("/banking/imports/preview", {
          method: "POST",
          body: {
            bankAccountId: importAccount,
            fileName: csv.name,
            csv: csv.content,
            mapping: importMapping,
          },
        }),
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function confirmCsv() {
    if (!csv || !importAccount) return;
    setBusy(true);
    try {
      await api("/banking/imports", {
        method: "POST",
        body: {
          bankAccountId: importAccount,
          fileName: csv.name,
          csv: csv.content,
          mapping: importMapping,
        },
      });
      setImportModal(false);
      setCsv(null);
      setPreview(null);
      onSaved("Bank statement imported.");
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function openMatch(row: Transaction) {
    setMatching(row);
    setSelectedCandidate("");
    setCandidates([]);
    try {
      setCandidates(await api<Candidate[]>(`/banking/transactions/${row.id}/suggestions`));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function reconcile() {
    const candidate = candidates.find((item) => item.targetId === selectedCandidate);
    if (!matching || !candidate) return;
    setBusy(true);
    try {
      await api(`/banking/transactions/${matching.id}/reconcile`, {
        method: "POST",
        body: { targetType: candidate.targetType, targetId: candidate.targetId },
      });
      setMatching(null);
      onSaved("Transaction reconciled.");
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function reverse(row: Transaction) {
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
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function openBatch() {
    try {
      const rows = await api<Obligation[]>("/banking/payment-obligations");
      setObligations(rows);
      setSelectedEntries([]);
      setBatchName("");
      setBatchModal(true);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function createBatch() {
    const selected = obligations.filter((item) => selectedEntries.includes(item.id));
    if (!selected.length) return;
    const runId = selected[0]!.payrollRunId;
    setBusy(true);
    try {
      await api("/banking/payment-batches", {
        method: "POST",
        body: {
          name: batchName,
          payrollRunId: runId,
          entryIds: selected.map((item) => item.id),
          bankAccountId: importAccount || undefined,
        },
      });
      setBatchModal(false);
      onSaved("Payroll payment batch created.");
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function updateBatchItem(batch: Batch, item: BatchItem, status: BatchItem["status"]) {
    try {
      const paymentReference =
        status === "PAID"
          ? window.prompt("Payment reference (optional)", "") || undefined
          : undefined;
      await api(`/banking/payment-batches/${batch.id}/items/${item.id}`, {
        method: "PATCH",
        body: { status, paymentReference, expectedVersion: batch.version },
      });
      onSaved(`Payment item marked ${status.toLowerCase()}.`);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <div className="banking-page">
      {error && (
        <div className="alert" role="alert">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      <BankingToolbar
        view={view}
        canManage={canManage}
        loading={loading}
        onViewChange={setView}
        onAddAccount={() => setAccountModal(true)}
        onImport={() => setImportModal(true)}
        onCreateBatch={() => void openBatch()}
        onRefresh={() => void load()}
      />
      {loading ? (
        <section className="panel loading">
          <span className="spinner" />
          Loading banking records…
        </section>
      ) : view === "accounts" ? (
        <BankAccountGrid accounts={accounts} />
      ) : view === "transactions" ? (
        <BankTransactionsTable
          transactions={visibleTransactions}
          total={transactions.length}
          accounts={accountById}
          search={transactionSearch}
          status={transactionStatus}
          canReconcile={canReconcile}
          onSearchChange={setTransactionSearch}
          onStatusChange={setTransactionStatus}
          onMatch={(row) => void openMatch(row)}
          onReverse={(row) => void reverse(row)}
        />
      ) : view === "imports" ? (
        <BankImportsTable imports={imports} />
      ) : (
        <PaymentBatchesPanel
          batches={batches}
          canManage={canManage}
          onUpdateItem={(batch, item, status) => void updateBatchItem(batch, item, status)}
        />
      )}
      {accountModal && (
        <BankAccountDialog
          account={account}
          busy={busy}
          onChange={setAccount}
          onClose={() => setAccountModal(false)}
          onSubmit={saveAccount}
        />
      )}
      {importModal && (
        <ImportStatementDialog
          accounts={accounts}
          accountId={importAccount}
          csv={csv}
          preview={preview}
          mapping={importMapping}
          busy={busy}
          onAccountChange={setImportAccount}
          onCsvChange={(nextCsv) => {
            setCsv(nextCsv);
            setPreview(null);
          }}
          onMappingChange={(mapping) => {
            setImportMapping(mapping);
            setPreview(null);
          }}
          onError={setError}
          onClose={() => {
            setImportModal(false);
            setPreview(null);
          }}
          onSubmit={preview ? confirmCsv : previewCsv}
        />
      )}
      {matching && (
        <ReconciliationDialog
          transaction={matching}
          candidates={candidates}
          selected={selectedCandidate}
          busy={busy}
          onSelected={setSelectedCandidate}
          onClose={() => setMatching(null)}
          onSubmit={reconcile}
        />
      )}
      {batchModal && (
        <PaymentBatchDialog
          accounts={accounts}
          obligations={obligations}
          accountId={importAccount}
          name={batchName}
          selected={selectedEntries}
          busy={busy}
          onAccountChange={setImportAccount}
          onNameChange={setBatchName}
          onSelectedChange={setSelectedEntries}
          onClose={() => setBatchModal(false)}
          onSubmit={createBatch}
        />
      )}
    </div>
  );
}
