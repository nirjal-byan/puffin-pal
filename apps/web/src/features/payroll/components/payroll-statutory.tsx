"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import type {
  StatutoryFormState,
  StatutoryJurisdiction,
  StatutoryPreview,
  StatutoryReport,
  StatutoryRuleSet,
} from "../types";
import { StatutoryConfigurationDialog } from "../dialogs/statutory-configuration-dialog";
import {
  StatutoryPreviewControls,
  StatutoryPreviewTable,
  StatutorySummary,
} from "./statutory-results";

export function PayrollStatutory({
  api,
  run,
  onApplied,
}: {
  api: WorkspaceApi;
  run?: { id: string; version: number; status: string; currency: string };
  onApplied?: () => Promise<void>;
}) {
  const [rules, setRules] = useState<StatutoryRuleSet[]>([]);
  const [jurisdictions, setJurisdictions] = useState<StatutoryJurisdiction[]>([]);
  const [report, setReport] = useState<StatutoryReport | null>(null);
  const [ruleSetId, setRuleSetId] = useState("");
  const [preview, setPreview] = useState<StatutoryPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<StatutoryFormState>({
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
      api<StatutoryRuleSet[]>("/payroll/statutory/rules"),
      api<StatutoryJurisdiction[]>("/payroll/statutory/jurisdictions"),
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
      const jurisdiction = await api<StatutoryJurisdiction>("/payroll/statutory/jurisdictions", {
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
      const created = await api<StatutoryRuleSet>("/payroll/statutory/rules", {
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
        await api<StatutoryPreview>(`/payroll/runs/${run.id}/statutory/preview`, {
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
        <StatutorySummary report={report} currency={jurisdictions[0]?.currency ?? ""} />
      )}
      {run?.status === "DRAFT" && (
        <StatutoryPreviewControls
          rules={rules}
          ruleSetId={ruleSetId}
          onRuleSetChange={setRuleSetId}
          onPreview={() => void calculatePreview()}
        />
      )}
      {preview && <StatutoryPreviewTable preview={preview} onApply={() => void apply()} />}
      {open && (
        <StatutoryConfigurationDialog
          form={form}
          onChange={setForm}
          onClose={() => setOpen(false)}
          onSubmit={configure}
        />
      )}
    </section>
  );
}
