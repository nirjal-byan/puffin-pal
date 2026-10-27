"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Permission } from "@puffinpal/permissions";
import type { WorkspaceApi } from "@/lib/api";
import { errorMessage } from "@/lib/api";
import { Dropdown } from "@/components/ui/dropdown";
import {
  FormCheckbox,
  FormField,
  FormFilePicker,
  FormModal,
  FormModalIntro,
  FormModalSection,
} from "@/components/ui/form-modal";
import {
  BANKING_CURRENCIES as CURRENCIES,
  DEFAULT_IMPORT_MAPPING as defaultMapping,
} from "./constants";
import type {
  BankAccount as Account,
  BankImport as ImportRow,
  BankingView,
  BankTransaction as Transaction,
  PaymentBatch as Batch,
  PaymentBatchItem as BatchItem,
  PayrollObligation as Obligation,
  ReconciliationCandidate as Candidate,
} from "./types";
import { BankAccountGrid } from "./bank-account-grid";

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
  const [preview, setPreview] = useState<{
    rowCount: number;
    duplicateCount: number;
    rows: Array<{ date: string; description: string; amount: string; duplicate: boolean }>;
  } | null>(null);
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
      <section className="panel banking-toolbar">
        <div className="banking-tabs" role="tablist" aria-label="Banking views">
          {(["transactions", "accounts", "imports", "batches"] as const).map((item) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              type="button"
              onClick={() => setView(item)}
            >
              {item === "batches" ? "Payment batches" : item[0]!.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div className="banking-actions">
          {canManage && view === "accounts" && (
            <button className="button primary" onClick={() => setAccountModal(true)}>
              + Add account
            </button>
          )}
          {canManage && (view === "transactions" || view === "imports") && (
            <button className="button primary" onClick={() => setImportModal(true)}>
              Import statement
            </button>
          )}
          {canManage && view === "batches" && (
            <button className="button primary" onClick={openBatch}>
              + Payment batch
            </button>
          )}
          <button className="button secondary" onClick={load} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </section>

      {loading ? (
        <section className="panel loading">
          <span className="spinner" />
          Loading banking records…
        </section>
      ) : view === "accounts" ? (
        <BankAccountGrid accounts={accounts} />
      ) : view === "transactions" ? (
        <section className="panel banking-table-panel">
          <header>
            <div>
              <h3>Statement transactions</h3>
              <p>Imported bank activity and its reconciliation status.</p>
            </div>
            <span>{transactions.length} records</span>
          </header>
          <div className="banking-filters">
            <input
              aria-label="Search transactions"
              placeholder="Search description, reference, or account"
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
            />
            <Dropdown
              name="transaction-status"
              label="Reconciliation status"
              searchable={false}
              value={transactionStatus}
              onChange={setTransactionStatus}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "MATCHED", label: "Matched" },
                { value: "UNMATCHED", label: "Unmatched" },
              ]}
            />
          </div>
          <div className="table-scroll">
            <table className="banking-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.transactionDate).toLocaleDateString()}</td>
                    <td>
                      <strong>{row.description}</strong>
                      <small>{row.reference || "No reference"}</small>
                    </td>
                    <td>{accountById.get(row.bankAccountId)?.displayName ?? "Bank account"}</td>
                    <td className={row.direction === "CREDIT" ? "money-in" : "money-out"}>
                      {row.direction === "CREDIT" ? "+" : "−"}
                      {row.currency} {row.amount}
                    </td>
                    <td>
                      <span className={`status-pill ${row.reconciliation ? "matched" : "pending"}`}>
                        {row.reconciliation ? "Matched" : "Unmatched"}
                      </span>
                    </td>
                    <td>
                      {canReconcile &&
                        (row.reconciliation ? (
                          <button className="text-button" onClick={() => reverse(row)}>
                            Reverse
                          </button>
                        ) : (
                          <button
                            className="button secondary compact"
                            onClick={() => openMatch(row)}
                          >
                            Match
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!transactions.length && (
            <div className="empty-state">
              <h3>No imported transactions</h3>
              <p>Import a CSV bank statement to begin reconciliation.</p>
            </div>
          )}
        </section>
      ) : view === "imports" ? (
        <section className="panel banking-table-panel">
          <header>
            <div>
              <h3>Import history</h3>
              <p>Every confirmed file is retained as an auditable batch.</p>
            </div>
          </header>
          <div className="table-scroll">
            <table className="banking-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Date</th>
                  <th>Rows</th>
                  <th>Imported</th>
                  <th>Duplicates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.fileName}</strong>
                    </td>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>{row.rowCount}</td>
                    <td>{row.importedCount}</td>
                    <td>{row.duplicateCount}</td>
                    <td>
                      <span className="status-pill matched">{row.status.replaceAll("_", " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="banking-batches">
          {batches.map((batch) => (
            <article className="panel banking-batch" key={batch.id}>
              <header>
                <div>
                  <span className="eyebrow">{batch.status}</span>
                  <h3>{batch.name}</h3>
                </div>
                <strong>
                  {batch.currency} {batch.totalAmount}
                </strong>
              </header>
              <div>
                {batch.items.map((item) => (
                  <div className="banking-batch-item" key={item.id}>
                    <span>{item.employeeName}</span>
                    <span>
                      {batch.currency} {item.amount}
                    </span>
                    <span
                      className={`status-pill ${item.status === "PAID" ? "matched" : "pending"}`}
                    >
                      {item.status}
                    </span>
                    {canManage && item.status !== "PAID" && (
                      <div className="batch-item-actions">
                        <button
                          className="text-button"
                          onClick={() => updateBatchItem(batch, item, "ATTEMPTED")}
                        >
                          Attempted
                        </button>
                        <button
                          className="text-button"
                          onClick={() => updateBatchItem(batch, item, "PAID")}
                        >
                          Mark paid
                        </button>
                        <button
                          className="text-button"
                          onClick={() => updateBatchItem(batch, item, "FAILED")}
                        >
                          Failed
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
          {!batches.length && (
            <section className="panel empty-state">
              <h3>No payment batches</h3>
              <p>Group finalized payroll obligations into a controlled payment checklist.</p>
            </section>
          )}
        </section>
      )}

      {accountModal && (
        <FormModal
          title="Add bank account"
          badge="Banking"
          wide
          onClose={() => setAccountModal(false)}
          onSubmit={saveAccount}
          submitLabel="Add account"
          submitting={busy}
        >
          <FormModalIntro icon="▰" title="Account details">
            Store only a recognizable name and masked identifier. PuffinPal never asks for
            online-banking credentials.
          </FormModalIntro>
          <FormModalSection
            title="Identification"
            description="Visible to authorized finance users"
          >
            <div className="standard-form-grid">
              <FormField label="Account name">
                <input
                  required
                  value={account.displayName}
                  onChange={(e) => setAccount({ ...account, displayName: e.target.value })}
                  placeholder="Operating account"
                />
              </FormField>
              <FormField label="Bank">
                <input
                  required
                  value={account.bankName}
                  onChange={(e) => setAccount({ ...account, bankName: e.target.value })}
                  placeholder="Bank name"
                />
              </FormField>
              <FormField label="Account holder">
                <input
                  required
                  value={account.accountHolder}
                  onChange={(e) => setAccount({ ...account, accountHolder: e.target.value })}
                />
              </FormField>
              <FormField label="Masked identifier" hint="Example: •••• 4821">
                <input
                  required
                  value={account.maskedIdentifier}
                  onChange={(e) => setAccount({ ...account, maskedIdentifier: e.target.value })}
                  placeholder="•••• 4821"
                />
              </FormField>
              <FormField label="Currency">
                <Dropdown
                  name="account-currency"
                  label="Currency"
                  searchable={false}
                  value={account.currency}
                  onChange={(currency) => setAccount({ ...account, currency })}
                  options={CURRENCIES.map((value) => ({ value, label: value }))}
                />
              </FormField>
              <FormField label="Country code">
                <input
                  required
                  maxLength={2}
                  value={account.countryCode}
                  onChange={(e) =>
                    setAccount({ ...account, countryCode: e.target.value.toUpperCase() })
                  }
                />
              </FormField>
            </div>
          </FormModalSection>
          <FormCheckbox
            checked={account.isDefault}
            onChange={(isDefault) => setAccount({ ...account, isDefault })}
            label="Use as the default bank account"
            description="New statement imports will select this account first."
          />
        </FormModal>
      )}

      {importModal && (
        <FormModal
          title="Import bank statement"
          badge="CSV"
          wide
          onClose={() => {
            setImportModal(false);
            setPreview(null);
          }}
          onSubmit={preview ? confirmCsv : previewCsv}
          submitLabel={preview ? "Confirm import" : "Preview statement"}
          submitting={busy}
          submitDisabled={!csv || !importAccount}
        >
          <FormModalIntro icon="⇧" title="Review before importing">
            CSV rows are validated and duplicates are detected before anything is stored.
          </FormModalIntro>
          <FormModalSection title="Statement file" description="Maximum 2 MB · up to 5,000 rows">
            <div className="standard-form-grid">
              <FormField label="Bank account">
                <Dropdown
                  name="import-account"
                  label="Bank account"
                  value={importAccount}
                  onChange={setImportAccount}
                  options={accounts
                    .filter((a) => a.isActive)
                    .map((a) => ({ value: a.id, label: `${a.displayName} · ${a.currency}` }))}
                />
              </FormField>
              <FormField label="CSV file">
                <FormFilePicker
                  accept=".csv,text/csv"
                  fileName={csv?.name}
                  title="Upload bank statement"
                  hint="CSV only · maximum 2 MB"
                  onChange={async (file) => {
                    if (!file) return;
                    if (file.size > 2_000_000) {
                      setError("CSV files must be 2 MB or smaller");
                      return;
                    }
                    setCsv({ name: file.name, content: await file.text() });
                    setPreview(null);
                  }}
                />
              </FormField>
            </div>
            {preview && (
              <div className="import-preview">
                <strong>
                  {preview.rowCount} rows ready · {preview.duplicateCount} duplicates will be
                  skipped
                </strong>
                {preview.rows.slice(0, 5).map((row, index) => (
                  <div key={`${row.date}-${index}`}>
                    <span>{row.date}</span>
                    <span>{row.description}</span>
                    <span>{row.amount}</span>
                    {row.duplicate && <small>Duplicate</small>}
                  </div>
                ))}
              </div>
            )}
            <details className="import-mapping">
              <summary>Column mapping</summary>
              <p className="muted">Enter the header used by your CSV for each field.</p>
              <div className="standard-form-grid">
                {(Object.keys(defaultMapping) as Array<keyof typeof defaultMapping>).map(
                  (field) => (
                    <FormField
                      key={field}
                      label={`${field[0]!.toUpperCase()}${field.slice(1)} column`}
                      optional={
                        field === "reference" || field === "direction" || field === "currency"
                      }
                    >
                      <input
                        required={field === "date" || field === "amount" || field === "description"}
                        value={importMapping[field]}
                        onChange={(event) => {
                          setImportMapping({ ...importMapping, [field]: event.target.value });
                          setPreview(null);
                        }}
                      />
                    </FormField>
                  ),
                )}
              </div>
            </details>
          </FormModalSection>
        </FormModal>
      )}

      {matching && (
        <FormModal
          title="Match bank transaction"
          badge="Reconciliation"
          onClose={() => setMatching(null)}
          onSubmit={reconcile}
          submitLabel="Confirm match"
          submitting={busy}
          submitDisabled={!selectedCandidate}
        >
          <FormModalIntro
            icon="✓"
            title={`${matching.currency} ${matching.amount} · ${matching.description}`}
          >
            Only unreconciled payment records with the same amount, direction, and currency are
            shown.
          </FormModalIntro>
          <FormModalSection title="Suggested records">
            {candidates.length ? (
              <div className="match-options">
                {candidates.map((item) => (
                  <label
                    key={item.targetId}
                    className={selectedCandidate === item.targetId ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      checked={selectedCandidate === item.targetId}
                      onChange={() => setSelectedCandidate(item.targetId)}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>
                        {item.date} · {item.reference || "No reference"}
                      </small>
                    </span>
                    <b>{item.amount}</b>
                  </label>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No exact matches</h3>
                <p>Record the corresponding payment first, or verify the amount and currency.</p>
              </div>
            )}
          </FormModalSection>
        </FormModal>
      )}

      {batchModal && (
        <FormModal
          title="Create payroll payment batch"
          badge="Payroll"
          wide
          onClose={() => setBatchModal(false)}
          onSubmit={createBatch}
          submitLabel="Create batch"
          submitting={busy}
          submitDisabled={!batchName.trim() || !selectedEntries.length}
        >
          <FormModalIntro icon="$" title="Prepare a payment checklist">
            This does not move money. It groups finalized, unpaid payroll entries for controlled
            processing.
          </FormModalIntro>
          <FormModalSection title="Batch details">
            <div className="standard-form-grid">
              <FormField label="Batch name">
                <input
                  required
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="October payroll payments"
                />
              </FormField>
              <FormField label="Bank account" optional>
                <Dropdown
                  name="batch-account"
                  label="Bank account"
                  value={importAccount}
                  onChange={setImportAccount}
                  options={accounts
                    .filter((a) => a.isActive)
                    .map((a) => ({ value: a.id, label: a.displayName }))}
                />
              </FormField>
            </div>
          </FormModalSection>
          <FormModalSection
            title="Eligible obligations"
            description="Select entries from one finalized pay run"
          >
            <div className="obligation-list">
              {obligations.map((item) => {
                const incompatible =
                  selectedEntries.length > 0 &&
                  obligations.find((row) => row.id === selectedEntries[0])?.payrollRunId !==
                    item.payrollRunId;
                return (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      disabled={incompatible}
                      checked={selectedEntries.includes(item.id)}
                      onChange={(e) =>
                        setSelectedEntries((rows) =>
                          e.target.checked
                            ? [...rows, item.id]
                            : rows.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span>
                      <strong>{item.employeeName}</strong>
                      <small>
                        {item.payrollRunName} · due {item.paymentDate}
                      </small>
                    </span>
                    <b>
                      {item.currency} {item.amount}
                    </b>
                  </label>
                );
              })}
              {!obligations.length && (
                <p className="muted">No finalized unpaid payroll entries are available.</p>
              )}
            </div>
          </FormModalSection>
        </FormModal>
      )}
    </div>
  );
}
