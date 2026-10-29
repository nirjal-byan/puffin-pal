import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [attendance, leave, overtime, payroll, retainers, workspaceRecords] = await Promise.all([
  read("../src/features/workforce/components/attendance-page.tsx"),
  read("../src/features/workforce/components/leave-page.tsx"),
  read("../src/features/workforce/components/overtime-page.tsx"),
  read("../src/features/payroll/components/payroll-page.tsx"),
  read("../src/features/recurring-invoices/components/retainers-page.tsx"),
  read("../src/features/workspace/hooks/use-workspace-records.ts"),
]);

test("attendance mutations keep failed dialogs open and use record versions for reviews", () => {
  assert.match(attendance, /if \(\s*await mutate[\s\S]*?setOpen\(false\)/);
  assert.match(attendance, /if \(\s*await mutate[\s\S]*?setCorrecting\(null\)/);
  assert.match(attendance, /expectedVersion: row\.version/);
  assert.match(attendance, /\/attendance\/\$\{action\}/);
});

test("leave creation completes before submission and preserves optimistic concurrency", () => {
  const createIndex = leave.indexOf("const created = await api<LeaveRequest>");
  const submitIndex = leave.indexOf("await api(`/leave/requests/${created.id}/submit`");
  assert.ok(createIndex >= 0 && submitIndex > createIndex);
  assert.match(leave, /body: \{ expectedVersion: created\.version \}/);
  assert.match(leave, /expectedVersion: request\.version/);
});

test("overtime creation completes before submission and optional compensation remains optional", () => {
  const createIndex = overtime.indexOf("const created = await api<OvertimeRequest>");
  const submitIndex = overtime.indexOf("await api(`/overtime/${created.id}/submit`");
  assert.ok(createIndex >= 0 && submitIndex > createIndex);
  assert.match(overtime, /hourlyRate: undefined/);
  assert.match(overtime, /multiplier: undefined/);
  assert.match(overtime, /expectedVersion: created\.version/);
});

test("payroll protects create/calculate ordering, versions, idempotent payments, and payslips", () => {
  const createIndex = payroll.indexOf('await api<PayrollRun>("/payroll/runs"');
  const calculateIndex = payroll.indexOf(
    "await api<PayrollRun>(`/payroll/runs/${run.id}/calculate`",
  );
  assert.ok(createIndex >= 0 && calculateIndex > createIndex);
  assert.match(payroll, /expectedVersion: selected\.version/);
  assert.match(payroll, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(payroll, /responseType: "file"/);
  assert.match(payroll, /payslip\/retry/);
});

test("retainer transitions remain versioned and occurrence retries stay schedule scoped", () => {
  assert.match(retainers, /body: \{ expectedVersion: row\.version \}/);
  assert.match(
    retainers,
    /\/recurring-invoices\/\$\{editing\.id\}\/occurrences\/\$\{occurrence\.id\}\/retry/,
  );
  assert.match(retainers, /endDate: form\.endDate \|\| undefined/);
});

test("workspace legacy requests are abortable and self-managed tabs avoid duplicate loading", () => {
  assert.match(workspaceRecords, /SELF_MANAGED_TABS\.has\(tab\)/);
  assert.match(workspaceRecords, /const controller = new AbortController\(\)/);
  assert.match(workspaceRecords, /signal: controller\.signal/);
  assert.match(workspaceRecords, /return \(\) => controller\.abort\(\)/);
});
