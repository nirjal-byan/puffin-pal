"use client";

import { useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import type { WorkspaceApi } from "@/lib/api";
import { errorMessage } from "@/lib/api";
import { DEFAULT_IMPORT_MAPPING as defaultMapping } from "../constants";
import type {
  BankImportPreview,
  BankingView,
  PaymentBatch as Batch,
  PaymentBatchItem as BatchItem,
  PayrollObligation as Obligation,
} from "../types";
import { BankAccountGrid } from "./bank-account-grid";
import { BankAccountDialog } from "../dialogs/bank-account-dialog";
import { BankImportsTable } from "./bank-imports-table";
import { BankingToolbar } from "./banking-toolbar";
import { BankTransactionsTable } from "./bank-transactions-table";
import { ImportStatementDialog } from "../dialogs/import-statement-dialog";
import { PaymentBatchDialog } from "../dialogs/payment-batch-dialog";
import { PaymentBatchesPanel } from "./payment-batches-panel";
import { ReconciliationDialog } from "../dialogs/reconciliation-dialog";
import { useBankingRecords } from "../hooks/use-banking-records";
import { useBankReconciliation } from "../hooks/use-bank-reconciliation";

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
  const {
    accounts,
    transactions,
    imports,
    batches,
    importAccount,
    setImportAccount,
    search: transactionSearch,
    setSearch: setTransactionSearch,
    status: transactionStatus,
    setStatus: setTransactionStatus,
    error,
    setError,
    loading,
    load,
    accountById,
    visibleTransactions,
  } = useBankingRecords(api);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [accountModal, setAccountModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
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
  const [csv, setCsv] = useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = useState<BankImportPreview | null>(null);
  const [importMapping, setImportMapping] = useState(defaultMapping);
  const [batchName, setBatchName] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const reconciliation = useBankReconciliation({ api, reload: load, onSaved, onError: setError });
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
          onMatch={(row) => void reconciliation.open(row)}
          onReverse={(row) => void reconciliation.reverse(row)}
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
      {reconciliation.transaction && (
        <ReconciliationDialog
          transaction={reconciliation.transaction}
          candidates={reconciliation.candidates}
          selected={reconciliation.selected}
          busy={reconciliation.busy}
          onSelected={reconciliation.setSelected}
          onClose={reconciliation.close}
          onSubmit={reconciliation.reconcile}
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
