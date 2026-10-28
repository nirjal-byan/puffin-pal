import { Dropdown } from "@/components/ui/dropdown";
import type { StatutoryPreview, StatutoryReport, StatutoryRuleSet } from "../types";

export function StatutorySummary({
  report,
  currency,
}: {
  report: StatutoryReport;
  currency: string;
}) {
  const values = [
    ["Finalized runs", String(report.finalizedPayrollRuns)],
    ["Tax withheld", `${currency} ${report.taxWithholding}`],
    ["Employee contributions", `${currency} ${report.employeeContributions}`],
    ["Employer contributions", `${currency} ${report.employerContributions}`],
    ["Net pay", `${currency} ${report.netPay}`],
    ["Total employer cost", `${currency} ${report.totalEmployerCost}`],
  ];
  return (
    <div className="payroll-summary statutory-report" aria-label="Finalized statutory summary">
      {values.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
      <p className="muted standard-form-grid-wide">{report.disclaimer}</p>
    </div>
  );
}

export function StatutoryPreviewControls({
  rules,
  ruleSetId,
  onRuleSetChange,
  onPreview,
}: {
  rules: StatutoryRuleSet[];
  ruleSetId: string;
  onRuleSetChange: (value: string) => void;
  onPreview: () => void;
}) {
  return (
    <div className="row-actions">
      <Dropdown
        name="statutoryRule"
        label="Statutory rule version"
        value={ruleSetId}
        onChange={onRuleSetChange}
        options={rules
          .filter((row) => row.status !== "DRAFT")
          .map((row) => ({
            value: row.id,
            label: `${row.name} v${row.version}${row.status === "SUPERSEDED" ? " (historical)" : ""}`,
          }))}
      />
      <button className="button secondary" disabled={!ruleSetId} onClick={onPreview}>
        Preview
      </button>
    </div>
  );
}

export function StatutoryPreviewTable({
  preview,
  onApply,
}: {
  preview: StatutoryPreview;
  onApply: () => void;
}) {
  return (
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
        onClick={onApply}
      >
        Apply statutory components
      </button>
    </div>
  );
}
