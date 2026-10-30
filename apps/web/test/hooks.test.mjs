import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHookHarness, flushPromises } from "./helpers/hook-harness.mjs";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalLocalStorage = globalThis.localStorage;
before(() => {
  globalThis.window = {
    cancelAnimationFrame() {},
    confirm: () => true,
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
  };
});
after(() => {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});

const { useBankingRecords } = await import("../src/features/banking/hooks/use-banking-records.ts");
const { useBankReconciliation } =
  await import("../src/features/banking/hooks/use-bank-reconciliation.ts");
const { useExpenseCollection } =
  await import("../src/features/expenses/hooks/use-expense-collection.ts");
const { useFinancialSummary } =
  await import("../src/features/dashboard/hooks/use-financial-summary.ts");
const { useEmployeeDirectory } =
  await import("../src/features/employees/hooks/use-employee-directory.ts");
const { usePayrollRuns } = await import("../src/features/payroll/hooks/use-payroll-runs.ts");
const { useWorkspaceRecords } =
  await import("../src/features/workspace/hooks/use-workspace-records.ts");
const { useWorkspaceTheme } =
  await import("../src/features/workspace/hooks/use-workspace-theme.ts");

test("banking records load together, select the default account, and filter transactions", async () => {
  const requests = [];
  const api = async (path) => {
    requests.push(path);
    if (path === "/banking/accounts")
      return [
        { id: "secondary", displayName: "Reserve", isDefault: false },
        { id: "primary", displayName: "Operating", isDefault: true },
      ];
    if (path.startsWith("/banking/transactions"))
      return [
        {
          id: "matched",
          bankAccountId: "primary",
          description: "Client receipt",
          reference: "INV-10",
          reconciliation: { id: "r1" },
        },
        {
          id: "open",
          bankAccountId: "secondary",
          description: "Hosting",
          reference: null,
          reconciliation: null,
        },
      ];
    if (path.startsWith("/banking/imports")) return [];
    if (path === "/banking/payment-batches") return [];
    throw new Error(`Unexpected request: ${path}`);
  };
  const harness = createHookHarness(useBankingRecords, api);
  harness.render();
  await flushPromises();
  let hook = harness.render();

  assert.deepEqual(requests, [
    "/banking/accounts",
    "/banking/transactions?limit=100&offset=0",
    "/banking/imports?limit=50&offset=0",
    "/banking/payment-batches",
  ]);
  assert.equal(hook.loading, false);
  assert.equal(hook.importAccount, "primary");

  hook.setSearch("operating");
  hook.setStatus("MATCHED");
  hook = harness.render();
  assert.deepEqual(
    hook.visibleTransactions.map((transaction) => transaction.id),
    ["matched"],
  );
  harness.unmount();
});

test("bank reconciliation saves the selected candidate before refreshing records", async () => {
  const events = [];
  const api = async (path, options) => {
    if (path.endsWith("/suggestions"))
      return [{ targetId: "invoice-1", targetType: "INVOICE", score: "1" }];
    events.push({ path, options });
  };
  const harness = createHookHarness(useBankReconciliation, {
    api,
    reload: async () => events.push("reload"),
    onSaved: (message) => events.push(message),
    onError: (message) => events.push(`error:${message}`),
  });
  let hook = harness.render();
  await hook.open({ id: "transaction-1", reconciliation: null });
  hook = harness.render();
  hook.setSelected("invoice-1");
  hook = harness.render();
  await hook.reconcile();

  assert.deepEqual(events, [
    {
      path: "/banking/transactions/transaction-1/reconcile",
      options: {
        method: "POST",
        body: { targetId: "invoice-1", targetType: "INVOICE" },
      },
    },
    "Transaction reconciled.",
    "reload",
  ]);
  assert.equal(harness.render().transaction, null);
  harness.unmount();
});

test("bank reconciliation keeps suggestions for the most recently opened transaction", async () => {
  let resolveFirst;
  let resolveSecond;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const second = new Promise((resolve) => {
    resolveSecond = resolve;
  });
  const api = (path) => (path.includes("transaction-1") ? first : second);
  const errors = [];
  const harness = createHookHarness(useBankReconciliation, {
    api,
    reload: async () => {},
    onSaved: () => {},
    onError: (message) => errors.push(message),
  });
  let hook = harness.render();
  const openingFirst = hook.open({ id: "transaction-1", reconciliation: null });
  hook = harness.render();
  const openingSecond = hook.open({ id: "transaction-2", reconciliation: null });

  resolveSecond([{ targetId: "new-candidate", targetType: "INVOICE_PAYMENT" }]);
  await openingSecond;
  hook = harness.render();
  assert.equal(hook.transaction.id, "transaction-2");
  assert.equal(hook.candidates[0].targetId, "new-candidate");

  resolveFirst([{ targetId: "old-candidate", targetType: "INVOICE_PAYMENT" }]);
  await openingFirst;
  hook = harness.render();
  assert.equal(hook.transaction.id, "transaction-2");
  assert.equal(hook.candidates[0].targetId, "new-candidate");
  assert.deepEqual(errors, []);
  harness.unmount();
});

test("banking load failures clear loading and a manual reload recovers", async () => {
  let failing = true;
  const api = async (path) => {
    if (failing) throw new Error("Banking unavailable");
    if (path === "/banking/accounts")
      return [{ id: "account-1", displayName: "Operating", isDefault: true }];
    return [];
  };
  const harness = createHookHarness(useBankingRecords, api);
  harness.render();
  await flushPromises();
  let hook = harness.render();
  assert.equal(hook.loading, false);
  assert.equal(hook.error, "Banking unavailable");

  failing = false;
  await hook.load();
  hook = harness.render();
  assert.equal(hook.error, "");
  assert.equal(hook.loading, false);
  assert.equal(hook.accounts[0].id, "account-1");
  harness.unmount();
});

test("banking records ignore an older load that finishes after a newer refresh", async () => {
  const deferred = Array.from({ length: 8 }, () => {
    let resolve;
    const promise = new Promise((next) => {
      resolve = next;
    });
    return { promise, resolve };
  });
  let request = 0;
  const api = async () => deferred[request++].promise;
  const harness = createHookHarness(useBankingRecords, api);
  harness.render();
  let hook = harness.render();
  const refresh = hook.load();

  deferred[4].resolve([{ id: "new-account", displayName: "New", isDefault: true }]);
  deferred[5].resolve([]);
  deferred[6].resolve([]);
  deferred[7].resolve([]);
  await refresh;
  hook = harness.render();
  assert.equal(hook.accounts[0].id, "new-account");

  deferred[0].resolve([{ id: "old-account", displayName: "Old", isDefault: true }]);
  deferred[1].resolve([]);
  deferred[2].resolve([]);
  deferred[3].resolve([]);
  await flushPromises();
  hook = harness.render();
  assert.equal(hook.accounts[0].id, "new-account");
  harness.unmount();
});

test("reconciliation reversal requires confirmation and sends the record version", async () => {
  const events = [];
  const api = async (path, options) => events.push({ path, options });
  const harness = createHookHarness(useBankReconciliation, {
    api,
    reload: async () => events.push("reload"),
    onSaved: (message) => events.push(message),
    onError: (message) => events.push(`error:${message}`),
  });
  const hook = harness.render();
  const row = { id: "transaction-1", reconciliation: { id: "match-1", version: 9 } };

  globalThis.window.confirm = () => false;
  await hook.reverse(row);
  assert.deepEqual(events, []);

  globalThis.window.confirm = () => true;
  await hook.reverse(row);
  assert.deepEqual(events, [
    {
      path: "/banking/reconciliations/match-1/reverse",
      options: {
        method: "POST",
        body: { expectedVersion: 9, reason: "Reversed by user" },
      },
    },
    "Reconciliation reversed.",
    "reload",
  ]);
  harness.unmount();
});

test("expense filters reset pagination and produce the existing date-range query", async () => {
  const requests = [];
  const api = async (path) => {
    requests.push(path);
    return { items: [], total: 0, pendingCount: 0, limit: 20, offset: 0 };
  };
  const harness = createHookHarness(useExpenseCollection, api);
  harness.render();
  await flushPromises();
  let hook = harness.render();
  hook.setOffset(40);
  hook.setFilters({
    ...hook.filters,
    approvalStatus: "PENDING_APPROVAL",
    period: "last7",
  });
  hook = harness.render();
  hook.applyFilters();
  harness.render();
  await flushPromises();

  const query = new URL(requests.at(-1), "https://example.test").searchParams;
  assert.equal(query.get("offset"), "0");
  assert.equal(query.get("approvalStatus"), "PENDING_APPROVAL");
  assert.ok(query.get("from"));
  assert.ok(query.get("to"));
  harness.unmount();
});

test("expense request failures remain visible and leave loading", async () => {
  const harness = createHookHarness(useExpenseCollection, async () => {
    throw new Error("Expenses unavailable");
  });
  harness.render();
  await flushPromises();
  const hook = harness.render();
  assert.equal(hook.failure, "Expenses unavailable");
  assert.equal(hook.loading, false);
  harness.unmount();
});

test("financial summary aborts an obsolete request during cleanup", async () => {
  let signal;
  let resolveRequest;
  const api = (_path, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };
  const harness = createHookHarness(useFinancialSummary, api, {
    from: "2026-10-01",
    to: "2026-10-31",
  });
  harness.render();
  await flushPromises();
  assert.equal(signal.aborted, false);
  harness.unmount();
  assert.equal(signal.aborted, true);
  resolveRequest({});
  await flushPromises();
});

test("financial summary reload repeats the same date contract and replaces the result", async () => {
  const paths = [];
  const api = async (path) => {
    paths.push(path);
    return { marker: paths.length };
  };
  const harness = createHookHarness(useFinancialSummary, api, {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  harness.render();
  await flushPromises();
  let hook = harness.render();
  assert.equal(hook.summary.marker, 1);
  hook.reload();
  harness.render();
  await flushPromises();
  hook = harness.render();
  assert.equal(hook.summary.marker, 2);
  assert.deepEqual(paths, [
    "/dashboard/financial-summary?from=2026-09-01&to=2026-09-30",
    "/dashboard/financial-summary?from=2026-09-01&to=2026-09-30",
  ]);
  harness.unmount();
});

test("employee directory applies search, status, and department filters", async () => {
  const api = async (path) => {
    if (path.startsWith("/employees"))
      return {
        items: [
          {
            id: "employee-1",
            employeeCode: "ENG-1",
            firstName: "Ada",
            lastName: "Lovelace",
            jobTitle: "Engineer",
            status: "ACTIVE",
            departmentId: "engineering",
          },
          {
            id: "employee-2",
            employeeCode: "OPS-1",
            firstName: "Grace",
            lastName: "Hopper",
            jobTitle: "Advisor",
            status: "TERMINATED",
            departmentId: "operations",
          },
        ],
      };
    if (path === "/departments") return [];
    if (path.startsWith("/members")) return [];
    throw new Error(`Unexpected request: ${path}`);
  };
  const harness = createHookHarness(useEmployeeDirectory, api, true);
  harness.render();
  await flushPromises();
  let hook = harness.render();
  hook.setSearch("engineer");
  hook.setStatusFilter("ACTIVE");
  hook.setDepartmentFilter("engineering");
  hook = harness.render();
  assert.deepEqual(
    hook.filteredEmployees.map((employee) => employee.id),
    ["employee-1"],
  );
  harness.unmount();
});

test("payroll run selection loads details and workforce review as one workflow", async () => {
  const requests = [];
  const api = async (path) => {
    requests.push(path);
    if (path === "/payroll/runs?limit=100&offset=0") return { items: [] };
    if (path === "/payroll/runs/run-1") return { id: "run-1", entries: [] };
    if (path === "/payroll/runs/run-1/workforce-review") return [{ employeeId: "employee-1" }];
    throw new Error(`Unexpected request: ${path}`);
  };
  const harness = createHookHarness(usePayrollRuns, api);
  harness.render();
  await flushPromises();
  let hook = harness.render();
  await hook.open({ id: "run-1" });
  hook = harness.render();

  assert.equal(hook.selected.id, "run-1");
  assert.deepEqual(hook.workforceReview, [{ employeeId: "employee-1" }]);
  assert.ok(requests.includes("/payroll/runs/run-1"));
  assert.ok(requests.includes("/payroll/runs/run-1/workforce-review"));
  harness.unmount();
});

test("payroll selection failures retain the previous selection and expose the error", async () => {
  const api = async (path) => {
    if (path === "/payroll/runs?limit=100&offset=0") return { items: [] };
    if (path.endsWith("/workforce-review")) return [];
    throw new Error("Payroll details unavailable");
  };
  const harness = createHookHarness(usePayrollRuns, api);
  harness.render();
  await flushPromises();
  let hook = harness.render();
  await hook.open({ id: "run-2" });
  hook = harness.render();
  assert.equal(hook.selected, null);
  assert.equal(hook.error, "Payroll details unavailable");
  harness.unmount();
});

test("workspace records abort obsolete requests and advance legacy pagination", async () => {
  const requests = [];
  const api = (path, options) => {
    requests.push({ path, signal: options.signal });
    return new Promise(() => {});
  };
  const harness = createHookHarness(useWorkspaceRecords, {
    api,
    tab: "clients",
    allowed: true,
    creatingInvoice: false,
  });
  let hook = harness.render();
  assert.equal(requests[0].path, "/clients?limit=20&offset=0");
  hook.next();
  hook = harness.render();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].path, "/clients?limit=20&offset=20");
  assert.equal(hook.offset, 20);
  harness.unmount();
  assert.equal(requests[1].signal.aborted, true);
});

test("workspace does not duplicate requests owned by self-managed features", () => {
  let requests = 0;
  const harness = createHookHarness(useWorkspaceRecords, {
    api: async () => {
      requests++;
      return [];
    },
    tab: "expenses",
    allowed: true,
    creatingInvoice: false,
  });
  const hook = harness.render();
  assert.equal(requests, 0);
  assert.deepEqual(hook.rows, []);
  harness.unmount();
});

test("workspace theme initializes from preference and persists toggles without transitions", () => {
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  };
  globalThis.document = {
    documentElement: { classList: { add() {}, remove() {} } },
  };
  globalThis.window = {
    matchMedia: (query) => ({
      matches: query.includes("prefers-color-scheme"),
    }),
  };
  const harness = createHookHarness(useWorkspaceTheme);
  let hook = harness.render();
  assert.equal(hook.theme, "dark");
  hook.toggleTheme();
  hook = harness.render();
  assert.equal(hook.theme, "light");
  assert.equal(stored.get("puffinpal-theme"), "light");
  harness.unmount();
});
