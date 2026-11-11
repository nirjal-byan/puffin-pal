import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import swc from "next/dist/build/swc/index.js";
import { createHookHarness, flushPromises } from "./helpers/hook-harness.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/link")
      return {
        shortCircuit: true,
        url: "data:text/javascript,export default function Link() { return null; }",
      };
    if (["react", "react-dom"].includes(specifier) && context.conditions?.includes("require")) {
      return {
        shortCircuit: true,
        url: new URL(`../node_modules/${specifier}/index.js`, import.meta.url).href,
      };
    }
    const result = next(specifier, context);
    if (specifier === "react")
      return {
        ...result,
        url: result.url + encodeURIComponent("\nexport const useId = () => 'test-id';"),
      };
    if (specifier === "react-dom")
      return {
        ...result,
        url:
          result.url + encodeURIComponent("\nexport const createPortal = (children) => children;"),
      };
    return result;
  },
  load(url, context, next) {
    if (url.startsWith("file:") && /\.tsx?$/.test(url))
      return {
        shortCircuit: true,
        format: "module",
        source: swc.transformSync(readFileSync(fileURLToPath(url), "utf8"), {
          filename: fileURLToPath(url),
          jsc: {
            parser: { syntax: "typescript", tsx: url.endsWith(".tsx") },
            transform: { react: { runtime: "automatic" } },
            target: "es2022",
          },
          module: { type: "es6" },
        }).code,
      };
    return next(url, context);
  },
});
const { default: PayrollPage } =
  await import("../src/features/payroll/components/payroll-page.tsx");
const { default: BankingPage } =
  await import("../src/features/banking/components/banking-page.tsx");
const { default: TeamPage } = await import("../src/features/team/components/team-page.tsx");

function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...elements(tree.props?.children)];
}
const named = (tree, name) => elements(tree).find((node) => node.type?.name === name);
const button = (tree, text) =>
  elements(tree).find(
    (node) => node.type === "button" && String(node.props.children).includes(text),
  );

const draft = {
  id: "run-1",
  version: 1,
  status: "DRAFT",
  name: "Payroll",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  paymentDate: "2026-12-01",
  entries: [],
  employeeCount: 0,
};

test("failed payroll calculation retries the saved draft with its latest version", async () => {
  const calls = [];
  let failCalculation = true;
  const api = async (path, options) => {
    calls.push({ path, options });
    if (path.startsWith("/employees")) return { items: [{ id: "employee-1", status: "ACTIVE" }] };
    if (path.includes("workforce-review")) return [];
    if (path.includes("?limit=")) return { items: [draft] };
    if (path.endsWith("/calculate")) {
      if (failCalculation) throw new Error("Missing salary configuration");
      return { ...draft, version: 3 };
    }
    if (path === "/payroll/runs" && options?.method === "POST") return draft;
    return { ...draft, version: 2 };
  };
  const h = createHookHarness(PayrollPage, {
    api,
    permissions: ["payroll:create", "payroll:manage"],
    onSaved() {},
  });
  h.render();
  await flushPromises();
  button(h.render(), "New pay run").props.onClick();
  h.render();
  await flushPromises();
  let dialog = named(h.render(), "CreatePayrollDialog");
  dialog.props.onCreate();
  await flushPromises();
  dialog = named(h.render(), "CreatePayrollDialog");
  assert.equal(dialog.props.existingDraft, true);
  assert.match(dialog.props.error, /Missing salary/);
  failCalculation = false;
  dialog.props.onCreate();
  await flushPromises();
  assert.equal(
    calls.filter((call) => call.path === "/payroll/runs" && call.options?.method === "POST").length,
    1,
  );
  assert.equal(
    calls.filter((call) => call.path.endsWith("/calculate")).at(-1).options.body.expectedVersion,
    2,
  );
  assert.equal(named(h.render(), "CreatePayrollDialog"), undefined);
  // A saved empty draft can reopen the existing employee selection dialog.
  named(h.render(), "PayrollRunDetails").props.onAction("calculate");
  h.render();
  await flushPromises();
  assert.equal(named(h.render(), "CreatePayrollDialog").props.existingDraft, true);
  h.unmount();
});

test("payment-checklist completion needs confirmation and cancellation makes no request", async () => {
  globalThis.window = {
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {},
  };
  const calls = [];
  const api = async (path, options) => {
    calls.push({ path, options });
    return [];
  };
  const h = createHookHarness(BankingPage, {
    api,
    permissions: ["banking:manage", "payroll:read"],
    onSaved() {},
  });
  h.render();
  await flushPromises();
  named(h.render(), "BankingToolbar").props.onViewChange("batches");
  const batch = { id: "batch-1", version: 4, currency: "USD" };
  const item = { id: "item-1", amount: "10.00", employeeName: "Employee" };
  named(h.render(), "PaymentBatchesPanel").props.onUpdateItem(batch, item, "PAID");
  let modal = named(h.render(), "FormModal");
  assert.match(modal.props.title, /checklist/);
  assert.equal(calls.filter((call) => call.options?.method === "PATCH").length, 0);
  modal.props.onClose();
  assert.equal(named(h.render(), "FormModal"), undefined);
  assert.equal(calls.filter((call) => call.options?.method === "PATCH").length, 0);
  named(h.render(), "PaymentBatchesPanel").props.onUpdateItem(batch, item, "PAID");
  modal = named(h.render(), "FormModal");
  await modal.props.onSubmit();
  await flushPromises();
  const writes = calls.filter((call) => call.options?.method === "PATCH");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "/banking/payment-batches/batch-1/items/item-1");
  assert.deepEqual(writes[0].options.body, {
    status: "PAID",
    expectedVersion: 4,
    paymentReference: undefined,
  });
  assert.equal(
    calls.some((call) => call.path.includes("/entries/")),
    false,
  );
  h.unmount();
  delete globalThis.window;
});

test("only owner/admin team views expose account provisioning and assignable roles", () => {
  for (const role of ["OWNER", "ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
    const h = createHookHarness(TeamPage, {
      members: [],
      role,
      api() {},
      onSaved() {},
      onError() {},
    });
    const tree = h.render();
    const forms = elements(tree).filter((node) => node.type === "form");
    assert.equal(forms.length, ["OWNER", "ADMIN"].includes(role) ? 1 : 0);
    h.unmount();
  }
});

test("payroll history distinguishes loading/failure and supports a successful retry", async () => {
  const { usePayrollRuns } = await import("../src/features/payroll/hooks/use-payroll-runs.ts");
  const requests = [];
  const api = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  const h = createHookHarness(usePayrollRuns, api);
  assert.equal(h.render().loading, true);
  requests[0].reject(new Error("Offline"));
  await flushPromises();
  assert.equal(h.render().loading, false);
  assert.match(h.render().error, /Offline/);
  const retry = h.render().load();
  assert.equal(h.render().loading, true);
  requests[1].resolve({ items: [draft] });
  await retry;
  assert.equal(h.render().loading, false);
  assert.equal(h.render().error, "");
  assert.equal(h.render().runs[0].id, draft.id);
  h.unmount();
});

test("payroll details expose refresh, show failures and protect in-flight payment actions", async () => {
  const { PayrollRunDetails } =
    await import("../src/features/payroll/components/payroll-run-details.tsx");
  const { PayrollEntriesTable } =
    await import("../src/features/payroll/components/payroll-entries-table.tsx");
  let refreshes = 0;
  const tree = PayrollRunDetails({
    run: draft,
    reviews: [],
    permissions: [],
    busy: true,
    error: "Try later",
    onRefresh: async () => {
      refreshes++;
    },
  });
  assert.equal(tree.props.dismissible, false);
  const refresh = button(tree, "Refresh details and payslips");
  assert.equal(refresh.props.disabled, true);
  assert.ok(
    elements(tree).some(
      (node) => node.props?.role === "alert" && node.props.children === "Try later",
    ),
  );
  const idle = PayrollRunDetails({
    run: draft,
    reviews: [],
    permissions: [],
    busy: false,
    onRefresh: async () => {
      refreshes++;
    },
  });
  button(idle, "Refresh details and payslips").props.onClick();
  assert.equal(refreshes, 1);
  const entries = PayrollEntriesTable({
    run: {
      ...draft,
      status: "FINALIZED",
      entries: [
        { id: "entry", payments: [], outstandingAmount: "10.00", payslipStatus: "COMPLETED" },
      ],
    },
    busy: true,
    canRecordPayments: true,
  });
  assert.equal(button(entries, "Record").props.disabled, true);
  assert.equal(button(entries, "Download").props.disabled, true);
});

test("access summary covers current areas and uses explicit real permissions", async () => {
  const { default: AccessPage } =
    await import("../src/features/settings/components/access-page.tsx");
  const tree = AccessPage({
    session: {
      user: {},
      organization: {},
      permissions: ["accounts-payable:read", "financial-reports:read"],
    },
    refreshing: false,
  });
  const rows = elements(tree).filter((node) => node.type === "tr");
  for (const label of [
    "Accounts payable",
    "Payroll",
    "Employees",
    "Banking",
    "Financial reports",
    "Team",
  ]) {
    const row = rows.find((node) =>
      elements(node).some((child) => child.type === "td" && child.props.children === label),
    );
    assert.ok(row, label);
    const text = JSON.stringify(row);
    assert.match(
      text,
      ["Accounts payable", "Financial reports"].includes(label) ? /✓ Allowed/ : /— Not allowed/,
    );
  }
});

test("closing payroll details invalidates a pending refresh instead of reopening the dialog", async () => {
  const { usePayrollRuns } = await import("../src/features/payroll/hooks/use-payroll-runs.ts");
  const pending = [];
  const api = (path) =>
    path.includes("?limit=")
      ? Promise.resolve({ items: [] })
      : new Promise((resolve) => pending.push(resolve));
  const h = createHookHarness(usePayrollRuns, api);
  h.render();
  await flushPromises();
  const refresh = h.render().open(draft);
  h.render().close();
  pending[0](draft);
  pending[1]([]);
  await refresh;
  assert.equal(h.render().selected, null);
  h.unmount();
});
