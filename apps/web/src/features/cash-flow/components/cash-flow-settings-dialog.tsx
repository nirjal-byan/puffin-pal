"use client";
import { useState, type FormEvent } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/form-modal";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type { CashFlowConfiguration } from "../types";

export function CashFlowSettingsDialog({
  api,
  configuration,
  onClose,
  onSaved,
}: {
  api: WorkspaceApi;
  configuration: CashFlowConfiguration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    ...configuration,
    openingBalanceDate: configuration.openingBalanceDate?.slice(0, 10) ?? "",
    openingBalance: configuration.openingBalance ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const update = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFailure("");
    try {
      await api("/cash-flow/configuration", {
        method: "PATCH",
        body: {
          expectedVersion: configuration.version,
          openingBalance: form.openingBalance || null,
          openingBalanceDate: form.openingBalanceDate || null,
          defaultHorizonDays: form.defaultHorizonDays,
          expectedInvoiceCollectionDelay: form.expectedInvoiceCollectionDelay,
          conservativeDelayAdjustmentDays: form.conservativeDelayAdjustmentDays,
          optimisticDelayAdjustmentDays: form.optimisticDelayAdjustmentDays,
          includeRecurringInvoices: form.includeRecurringInvoices,
          includeApprovedPayroll: form.includeApprovedPayroll,
          includeSalaryEstimates: form.includeSalaryEstimates,
          includeApprovedExpenses: form.includeApprovedExpenses,
        },
      });
      onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
      setSaving(false);
    }
  }
  const numberField = (
    label: string,
    key:
      | "expectedInvoiceCollectionDelay"
      | "conservativeDelayAdjustmentDays"
      | "optimisticDelayAdjustmentDays",
    hint: string,
  ) => (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min="0"
        max="365"
        value={form[key]}
        onChange={(event) => update(key, Number(event.target.value))}
      />
      <small>{hint}</small>
    </label>
  );
  return (
    <FormModal title="Cash flow settings" badge="Planning" onClose={onClose}>
      <form className="cash-flow-settings" onSubmit={submit}>
        <div className="cash-flow-settings-intro">
          <span aria-hidden="true">↗</span>
          <div>
            <strong>Forecast assumptions</strong>
            <p>
              Adjust how future cash movement is estimated. Your financial records remain unchanged.
            </p>
          </div>
        </div>
        {failure && (
          <p className="alert" role="alert">
            {failure}
          </p>
        )}
        <SettingsSection
          title="Starting position"
          description="Optional balance used as the forecast baseline."
        >
          <div className="cash-flow-settings-grid">
            <label>
              <span>Opening balance</span>
              <input
                value={form.openingBalance}
                onChange={(event) => update("openingBalance", event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
              <small>Leave blank to forecast movement without a running balance.</small>
            </label>
            <label>
              <span>Balance as of</span>
              <DatePicker
                value={form.openingBalanceDate}
                onChange={(value) => update("openingBalanceDate", value)}
                ariaLabel="Opening balance date"
              />
              <small>The date that the opening balance applies to.</small>
            </label>
          </div>
        </SettingsSection>
        <SettingsSection
          title="Timing assumptions"
          description="Control when projected money is expected to move."
        >
          <div className="cash-flow-settings-grid cash-flow-timing-grid">
            {numberField(
              "Expected invoice delay",
              "expectedInvoiceCollectionDelay",
              "Days after an invoice due date.",
            )}
            <label>
              <span>Default horizon</span>
              <Dropdown
                name="default-horizon"
                label="Default horizon"
                searchable={false}
                value={String(form.defaultHorizonDays)}
                onChange={(value) => update("defaultHorizonDays", Number(value))}
                options={[30, 60, 90, 180, 365].map((value) => ({
                  value: String(value),
                  label: value === 180 ? "6 months" : value === 365 ? "1 year" : `${value} days`,
                }))}
              />
              <small>The period shown when Cash Flow opens.</small>
            </label>
            {numberField(
              "Conservative extra delay",
              "conservativeDelayAdjustmentDays",
              "Additional days used in the conservative scenario.",
            )}
            {numberField(
              "Optimistic delay reduction",
              "optimisticDelayAdjustmentDays",
              "Days removed from expected collection timing.",
            )}
          </div>
        </SettingsSection>
        <SettingsSection
          title="Forecast sources"
          description="Choose which existing records contribute projections."
          className="cash-flow-options"
        >
          <div className="cash-flow-option-grid">
            {(
              [
                ["includeRecurringInvoices", "Recurring invoice projections"],
                ["includeApprovedPayroll", "Approved payroll before finalization"],
                ["includeSalaryEstimates", "Future salary estimates"],
                ["includeApprovedExpenses", "Approved future-dated expenses"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(event) => update(key, event.target.checked)}
                />
                <span className="cash-flow-switch" aria-hidden="true">
                  <span />
                </span>
                <span className="cash-flow-option-copy">
                  <strong>{label}</strong>
                  <small>
                    {key === "includeApprovedExpenses"
                      ? "Uses expense dates as a planning assumption."
                      : "Uses existing organization records only."}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </SettingsSection>
        <div className="modal-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
function SettingsSection({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`cash-flow-settings-section ${className}`}>
      <div className="cash-flow-settings-heading">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      {children}
    </section>
  );
}
