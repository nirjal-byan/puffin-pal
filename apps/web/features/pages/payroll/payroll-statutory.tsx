"use client";

import { useCallback, useEffect, useState } from "react";
import { DatePicker } from "../../../components/date-picker";
import { Dropdown } from "../../../components/dropdown";
import { CurrencyDropdown } from "../../../components/currency-dropdown";
import {
  FormCheckbox,
  FormField,
  FormModal,
  FormModalIntro,
  FormModalSection,
} from "../../../components/form-modal";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";

type RuleSet = { id: string; name: string; version: number; status: string };
type Jurisdiction = { id: string; countryCode: string; currency: string };
type Preview = {
  previewHash: string;
  results: Array<{
    entryId: string;
    employeeName: string;
    taxWithholding?: string;
    employeeContributions?: string;
    employerContributions?: string;
    netPay?: string;
    missingClassifications: string[];
  }>;
};
type StatutoryReport = {
  finalizedPayrollRuns: number;
  taxWithholding: string;
  employeeContributions: string;
  employerContributions: string;
  netPay: string;
  totalEmployerCost: string;
  disclaimer: string;
};

export function PayrollStatutory({
  api,
  run,
  onApplied,
}: {
  api: WorkspaceApi;
  run?: { id: string; version: number; status: string; currency: string };
  onApplied?: () => Promise<void>;
}) {
  const [rules, setRules] = useState<RuleSet[]>([]);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [report, setReport] = useState<StatutoryReport | null>(null);
  const [ruleSetId, setRuleSetId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    countryCode: "",
    subdivisionCode: "",
    currency: run?.currency ?? "USD",
    mandatoryCalculation: false,
    name: "Standard withholding",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    periodsPerYear: 12,
    taxMethod: "FLAT" as "FLAT" | "PROGRESSIVE",
    flatRate: "0.10",
    bracketThreshold: "50000.00",
    lowerBracketRate: "0.10",
    upperBracketRate: "0.20",
    employeeRate: "0.00",
    employerRate: "0.00",
  });

  const load = useCallback(async () => {
    const [configuredRules, configuredJurisdictions, reportData] = await Promise.all([
      api<RuleSet[]>("/payroll/statutory/rules"),
      api<Jurisdiction[]>("/payroll/statutory/jurisdictions"),
      api<StatutoryReport>("/payroll/statutory/reports"),
    ]);
    setRules(configuredRules);
    setJurisdictions(configuredJurisdictions);
    setReport(reportData);
    setRuleSetId(
      (current) => current || configuredRules.find((row) => row.status === "ACTIVE")?.id || "",
    );
  }, [api]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void load().catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  async function configure() {
    try {
      const jurisdiction = await api<Jurisdiction>("/payroll/statutory/jurisdictions", {
        method: "POST",
        body: {
          countryCode: form.countryCode.toUpperCase(),
          subdivisionCode: form.subdivisionCode.toUpperCase() || undefined,
          currency: form.currency.toUpperCase(),
          taxYearStartMonth: 1,
          taxYearStartDay: 1,
          mandatoryCalculation: form.mandatoryCalculation,
        },
      });
      const progressive = form.taxMethod === "PROGRESSIVE";
      const items = [
        !progressive && Number(form.flatRate) > 0
          ? {
              name: "Income tax withholding",
              kind: "FLAT_WITHHOLDING",
              calculationType: "RATE",
              calculationBase: "TAXABLE_EARNINGS",
              rate: form.flatRate,
            }
          : null,
        Number(form.employeeRate) > 0
          ? {
              name: "Employee statutory contribution",
              kind: "EMPLOYEE_CONTRIBUTION",
              calculationType: "RATE",
              calculationBase: "GROSS_EARNINGS",
              rate: form.employeeRate,
            }
          : null,
        Number(form.employerRate) > 0
          ? {
              name: "Employer statutory contribution",
              kind: "EMPLOYER_CONTRIBUTION",
              calculationType: "RATE",
              calculationBase: "GROSS_EARNINGS",
              rate: form.employerRate,
            }
          : null,
      ].filter(Boolean);
      const created = await api<RuleSet>("/payroll/statutory/rules", {
        method: "POST",
        body: {
          jurisdictionId: jurisdiction.id,
          name: form.name,
          version: rules.length + 1,
          effectiveFrom: form.effectiveFrom,
          periodsPerYear: form.periodsPerYear,
          brackets: progressive
            ? [
                {
                  lowerBound: "0.00",
                  upperBound: form.bracketThreshold,
                  rate: form.lowerBracketRate,
                },
                { lowerBound: form.bracketThreshold, rate: form.upperBracketRate },
              ]
            : [],
          rules: items,
        },
      });
      await api(`/payroll/statutory/rules/${created.id}/activate`, {
        method: "POST",
        body: { expectedVersion: created.version },
      });
      setOpen(false);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function calculatePreview() {
    if (!run || !ruleSetId) return;
    try {
      setPreview(
        await api<Preview>(`/payroll/runs/${run.id}/statutory/preview`, {
          method: "POST",
          body: { ruleSetId },
        }),
      );
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function apply() {
    if (!run || !preview) return;
    try {
      await api(`/payroll/runs/${run.id}/statutory/apply`, {
        method: "POST",
        body: { ruleSetId, expectedVersion: run.version, previewHash: preview.previewHash },
      });
      setPreview(null);
      await onApplied?.();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <section className="panel payroll-statutory">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Compliance</span>
          <h3>Tax and statutory deductions</h3>
          <p className="muted">Configure calculations and review finalized payroll totals.</p>
        </div>
        <button className="button secondary" onClick={() => setOpen(true)}>
          {jurisdictions.length ? "New rule version" : "Configure"}
        </button>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {!run && report && (
        <div className="payroll-summary statutory-report" aria-label="Finalized statutory summary">
          <div>
            <small>Finalized runs</small>
            <strong>{report.finalizedPayrollRuns}</strong>
          </div>
          <div>
            <small>Tax withheld</small>
            <strong>
              {jurisdictions[0]?.currency ?? ""} {report.taxWithholding}
            </strong>
          </div>
          <div>
            <small>Employee contributions</small>
            <strong>
              {jurisdictions[0]?.currency ?? ""} {report.employeeContributions}
            </strong>
          </div>
          <div>
            <small>Employer contributions</small>
            <strong>
              {jurisdictions[0]?.currency ?? ""} {report.employerContributions}
            </strong>
          </div>
          <div>
            <small>Net pay</small>
            <strong>
              {jurisdictions[0]?.currency ?? ""} {report.netPay}
            </strong>
          </div>
          <div>
            <small>Total employer cost</small>
            <strong>
              {jurisdictions[0]?.currency ?? ""} {report.totalEmployerCost}
            </strong>
          </div>
          <p className="muted standard-form-grid-wide">{report.disclaimer}</p>
        </div>
      )}
      {run?.status === "DRAFT" && (
        <div className="row-actions">
          <Dropdown
            name="statutoryRule"
            label="Statutory rule version"
            value={ruleSetId}
            onChange={setRuleSetId}
            options={rules
              .filter((row) => row.status !== "DRAFT")
              .map((row) => ({
                value: row.id,
                label: `${row.name} v${row.version}${row.status === "SUPERSEDED" ? " (historical)" : ""}`,
              }))}
          />
          <button
            className="button secondary"
            disabled={!ruleSetId}
            onClick={() => void calculatePreview()}
          >
            Preview
          </button>
        </div>
      )}
      {preview && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Tax</th>
                <th>Employee contribution</th>
                <th>Employer contribution</th>
                <th>Net pay</th>
              </tr>
            </thead>
            <tbody>
              {preview.results.map((row) => (
                <tr key={row.entryId}>
                  <td>
                    {row.employeeName}
                    {row.missingClassifications.length > 0 && (
                      <small className="muted payroll-subtitle">
                        Classify: {row.missingClassifications.join(", ")}
                      </small>
                    )}
                  </td>
                  <td>{row.taxWithholding ?? "Review required"}</td>
                  <td>{row.employeeContributions ?? "—"}</td>
                  <td>{row.employerContributions ?? "—"}</td>
                  <td>{row.netPay ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="button primary"
            disabled={preview.results.some((row) => row.missingClassifications.length > 0)}
            onClick={() => void apply()}
          >
            Apply statutory components
          </button>
        </div>
      )}
      {open && (
        <FormModal
          title="Configure statutory rules"
          badge="Payroll"
          onClose={() => setOpen(false)}
          onSubmit={configure}
          submitLabel="Save and activate"
        >
          <FormModalIntro icon="%" title="Set statutory calculation rules">
            Configure verified rates and effective dates. A decimal rate of 0.10 means 10%. This
            setup is not legal or tax advice.
          </FormModalIntro>
          <FormModalSection title="Jurisdiction" description="Tax authority and reporting currency">
            <div className="standard-form-grid">
              <FormField label="Country code">
                <input
                  maxLength={2}
                  value={form.countryCode}
                  onChange={(event) => setForm({ ...form, countryCode: event.target.value })}
                  placeholder="US"
                />
              </FormField>
              <FormField label="Region" optional>
                <input
                  value={form.subdivisionCode}
                  onChange={(event) => setForm({ ...form, subdivisionCode: event.target.value })}
                />
              </FormField>
              <FormField label="Currency">
                <CurrencyDropdown
                  value={form.currency}
                  onChange={(currency) => setForm({ ...form, currency })}
                  name="statutory-currency"
                  label="Statutory reporting currency"
                />
              </FormField>
            </div>
          </FormModalSection>
          <FormModalSection
            title="Effective rule version"
            description="Calculation method and dates"
          >
            <div className="standard-form-grid">
              <FormField label="Rule-set name">
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </FormField>
              <FormField label="Effective from">
                <DatePicker
                  value={form.effectiveFrom}
                  onChange={(effectiveFrom) => setForm({ ...form, effectiveFrom })}
                  ariaLabel="Statutory rule effective date"
                />
              </FormField>
              <FormField label="Pay periods per year">
                <Dropdown
                  name="statutory-periods"
                  label="Pay periods per year"
                  searchable={false}
                  value={String(form.periodsPerYear)}
                  onChange={(value) => setForm({ ...form, periodsPerYear: Number(value) })}
                  options={[12, 24, 26, 52].map((value) => ({
                    value: String(value),
                    label: `${value} periods`,
                  }))}
                />
              </FormField>
              <FormField label="Income-tax method">
                <Dropdown
                  name="statutory-tax-method"
                  label="Income-tax method"
                  searchable={false}
                  value={form.taxMethod}
                  onChange={(value) =>
                    setForm({ ...form, taxMethod: value as "FLAT" | "PROGRESSIVE" })
                  }
                  options={[
                    { value: "FLAT", label: "Flat withholding rate" },
                    { value: "PROGRESSIVE", label: "Two progressive brackets" },
                  ]}
                />
              </FormField>
              {form.taxMethod === "FLAT" ? (
                <FormField label="Flat withholding rate">
                  <input
                    inputMode="decimal"
                    value={form.flatRate}
                    onChange={(event) => setForm({ ...form, flatRate: event.target.value })}
                  />
                </FormField>
              ) : (
                <>
                  <FormField label="First bracket ends at">
                    <input
                      inputMode="decimal"
                      value={form.bracketThreshold}
                      onChange={(event) =>
                        setForm({ ...form, bracketThreshold: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="First bracket rate">
                    <input
                      inputMode="decimal"
                      value={form.lowerBracketRate}
                      onChange={(event) =>
                        setForm({ ...form, lowerBracketRate: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Remaining income rate">
                    <input
                      inputMode="decimal"
                      value={form.upperBracketRate}
                      onChange={(event) =>
                        setForm({ ...form, upperBracketRate: event.target.value })
                      }
                    />
                  </FormField>
                </>
              )}
              <FormField label="Employee contribution rate">
                <input
                  inputMode="decimal"
                  value={form.employeeRate}
                  onChange={(event) => setForm({ ...form, employeeRate: event.target.value })}
                />
              </FormField>
              <FormField label="Employer contribution rate">
                <input
                  inputMode="decimal"
                  value={form.employerRate}
                  onChange={(event) => setForm({ ...form, employerRate: event.target.value })}
                />
              </FormField>
            </div>
          </FormModalSection>
          <FormCheckbox
            checked={form.mandatoryCalculation}
            onChange={(mandatoryCalculation) => setForm({ ...form, mandatoryCalculation })}
            label="Require statutory calculations before approval"
            description="Blocks submission until every payroll entry has an applied snapshot."
          />
        </FormModal>
      )}
    </section>
  );
}
