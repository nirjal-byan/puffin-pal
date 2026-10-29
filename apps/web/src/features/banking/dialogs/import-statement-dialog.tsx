import { Dropdown } from "@/components/ui/dropdown";
import {
  FormField,
  FormFilePicker,
  FormModal,
  FormModalIntro,
  FormModalSection,
} from "@/components/ui/form-modal";
import { DEFAULT_IMPORT_MAPPING } from "../constants";
import type { BankAccount, BankImportMapping, BankImportPreview } from "../types";

export function ImportStatementDialog({
  accounts,
  accountId,
  csv,
  preview,
  mapping,
  busy,
  onAccountChange,
  onCsvChange,
  onMappingChange,
  onError,
  onClose,
  onSubmit,
}: {
  accounts: BankAccount[];
  accountId: string;
  csv: { name: string; content: string } | null;
  preview: BankImportPreview | null;
  mapping: BankImportMapping;
  busy: boolean;
  onAccountChange: (id: string) => void;
  onCsvChange: (csv: { name: string; content: string } | null) => void;
  onMappingChange: (mapping: BankImportMapping) => void;
  onError: (message: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <FormModal
      title="Import bank statement"
      badge="CSV"
      wide
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={preview ? "Confirm import" : "Preview statement"}
      submitting={busy}
      submitDisabled={!csv || !accountId}
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
              value={accountId}
              onChange={onAccountChange}
              options={accounts
                .filter((account) => account.isActive)
                .map((account) => ({
                  value: account.id,
                  label: `${account.displayName} · ${account.currency}`,
                }))}
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
                  onError("CSV files must be 2 MB or smaller");
                  return;
                }
                onCsvChange({ name: file.name, content: await file.text() });
              }}
            />
          </FormField>
        </div>
        {preview && (
          <div className="import-preview">
            <strong>
              {preview.rowCount} rows ready · {preview.duplicateCount} duplicates will be skipped
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
            {(Object.keys(DEFAULT_IMPORT_MAPPING) as Array<keyof BankImportMapping>).map(
              (field) => (
                <FormField
                  key={field}
                  label={`${field[0]!.toUpperCase()}${field.slice(1)} column`}
                  optional={field === "reference" || field === "direction" || field === "currency"}
                >
                  <input
                    required={field === "date" || field === "amount" || field === "description"}
                    value={mapping[field]}
                    onChange={(event) =>
                      onMappingChange({ ...mapping, [field]: event.target.value })
                    }
                  />
                </FormField>
              ),
            )}
          </div>
        </details>
      </FormModalSection>
    </FormModal>
  );
}
