import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialTour,
  tourSteps,
  tourStorageKey,
  adjacentStep,
  tourPosition,
  visibleTourTarget,
  invoiceTourRoute,
  paymentTourLink,
  paymentTourWaiting,
} from "../features/onboarding/tour.ts";

test("payment steps wait for invoice data instead of treating loading as missing controls", () => {
  let loading = true;
  const root = {
    querySelector(selector) {
      assert.equal(selector, '.workspace-main .panel.loading[role="status"]');
      return loading ? {} : null;
    },
  };
  assert.equal(paymentTourWaiting(root), true);
  loading = false;
  assert.equal(paymentTourWaiting(root), false);
});

test("only newly registered users automatically start onboarding", () => {
  assert.equal(initialTour({ onboardingStatus: "PENDING" }, null).active, true);
  for (const onboardingStatus of [undefined, "LEGACY", "COMPLETED", "SKIPPED"])
    assert.equal(initialTour({ onboardingStatus }, null).active, false);
});
test("refresh resumes the saved step instead of restarting; terminal server state wins", () => {
  const saved = { active: true, manual: false, step: "invoices" };
  assert.deepEqual(initialTour({ onboardingStatus: "PENDING" }, saved), saved);
  assert.equal(
    initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: "clients" }, null).step,
    "clients",
  );
  assert.equal(initialTour({ onboardingStatus: "COMPLETED" }, saved).active, false);
  assert.equal(initialTour({ onboardingStatus: "SKIPPED" }, saved).active, false);
  assert.equal(
    initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: "bad" }, null).step,
    "welcome",
  );
  assert.equal(
    initialTour({ onboardingStatus: "PENDING" }, { active: true, step: "bad", manual: false }).step,
    "welcome",
  );
});
test("manual replay works for existing users without changing previous completion", () => {
  const replay = { active: true, manual: true, step: "welcome" };
  for (const onboardingStatus of ["LEGACY", "COMPLETED", "SKIPPED"])
    assert.deepEqual(initialTour({ onboardingStatus }, replay), replay);
  const skippedReplay = { ...replay, active: false };
  assert.deepEqual(initialTour({ onboardingStatus: "COMPLETED" }, skippedReplay), skippedReplay);
  assert.equal(tourStorageKey("user-1"), "puffinpal-tour-v1:user-1");
  assert.notEqual(tourStorageKey("user-1"), tourStorageKey("user-2"));
});
test("steps respect permissions and gracefully advance past removed steps", () => {
  const viewer = tourSteps(["profile:read", "clients:read", "invoices:read"]);
  assert.ok(viewer.some((step) => step.id === "invoices"));
  assert.ok(!viewer.some((step) => step.id === "team" || step.id === "create-invoice"));
  assert.equal(adjacentStep(viewer, "create-invoice", 1), "issuance");
  assert.equal(adjacentStep(viewer, "team", 1), "settings");
  assert.equal(adjacentStep(viewer, "clients", -1), "dashboard");
  assert.equal(adjacentStep(viewer, "welcome", -1), "welcome");
  assert.equal(adjacentStep(viewer, "finish", 1), "finish");
  assert.ok(tourSteps(["members:manage"]).some((step) => step.id === "team"));
  assert.ok(!viewer.some((step) => /payroll|salary|expense/i.test(step.title)));
});

test("current feature steps are permission scoped", () => {
  const owner = tourSteps([
    "invoices:read",
    "invoices:create",
    "invoices:record-payment",
    "expenses:read",
    "expenses:approve",
    "retainers:read",
    "employees:read",
    "salaries:read",
    "members:manage",
  ]);
  for (const id of [
    "dashboard-charts",
    "bulk-exports",
    "expenses",
    "expense-approvals",
    "retainers",
    "employees",
    "salaries",
    "team",
  ])
    assert.ok(
      owner.some((step) => step.id === id),
      `missing ${id}`,
    );

  const employeeViewer = tourSteps(["employees:read"]);
  assert.ok(employeeViewer.some((step) => step.id === "employees"));
  assert.ok(!employeeViewer.some((step) => step.id === "salaries"));
  assert.ok(!tourSteps(["expenses:read"]).some((step) => step.id === "expense-approvals"));
});

test("record-dependent features use stable page-level spotlights", () => {
  const steps = tourSteps([
    "invoices:read",
    "invoices:record-payment",
    "expenses:read",
    "expenses:approve",
    "employees:read",
    "salaries:read",
  ]);
  for (const id of [
    "issuance",
    "payment-basics",
    "bulk-exports",
    "expense-approvals",
    "salaries",
  ]) {
    assert.equal(steps.find((step) => step.id === id)?.target, "page-heading");
  }
});
test("missing, hidden and zero-size targets are unavailable", (t) => {
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  t.after(() => {
    delete globalThis.getComputedStyle;
  });
  const target = { closest: () => null, getBoundingClientRect: () => ({ width: 40, height: 30 }) };
  assert.equal(visibleTourTarget(null), false);
  assert.equal(visibleTourTarget(target), true);
  assert.equal(visibleTourTarget({ ...target, closest: () => ({}) }), false);
  assert.equal(
    visibleTourTarget({ ...target, getBoundingClientRect: () => ({ width: 0, height: 30 }) }),
    false,
  );
  t.mock.method(globalThis, "getComputedStyle", () => ({ display: "none", visibility: "visible" }));
  assert.equal(visibleTourTarget(target), false);
});
test("popover remains inside desktop, mobile and short viewports", () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 360, height: 640 },
    { width: 320, height: 300 },
  ]) {
    for (const target of [
      null,
      { left: 20, top: 80, width: 120, height: 40 },
      { left: viewport.width - 80, top: viewport.height - 50, width: 60, height: 30 },
    ]) {
      const panel = { width: 360, height: 260 };
      const position = tourPosition(target, viewport, panel);
      assert.ok(position.left >= 12);
      assert.ok(position.top >= 12);
      assert.ok(position.left + position.width <= viewport.width - 12);
      assert.ok(
        position.top + Math.min(panel.height, viewport.height - 24) <= viewport.height - 12,
      );
    }
  }
  const target = { left: 20, top: 80, width: 120, height: 40 };
  assert.ok(
    tourPosition(target, { width: 1440, height: 900 }, { width: 360, height: 260 }).left >
      target.left + target.width,
  );
});

test("payment explanations follow permissions for readers and payment recorders", () => {
  const reader = tourSteps(["invoices:read"]);
  assert.ok(reader.some((step) => step.id === "issuance"));
  assert.ok(!reader.some((step) => step.id === "payment-basics"));
  const writer = tourSteps(["invoices:read", "invoices:record-payment"]);
  assert.equal(writer.find((step) => step.id === "payment-basics").target, "page-heading");
  assert.equal(writer.find((step) => step.id === "payment-basics").route, "/invoices");
  assert.ok(!tourSteps([]).some((step) => step.id === "payment-basics"));
});
test("old progress and completion survive new steps, which also resume during manual replay", () => {
  const old = { active: true, manual: false, step: "team" };
  assert.deepEqual(initialTour({ onboardingStatus: "IN_PROGRESS" }, old), old);
  assert.equal(initialTour({ onboardingStatus: "PENDING" }, null).step, "welcome");
  for (const status of ["LEGACY", "COMPLETED", "SKIPPED"])
    assert.equal(initialTour({ onboardingStatus: status }, null).active, false);
  for (const step of ["payment-basics", "record-payment", "payment-balance", "payment-history"]) {
    assert.equal(
      initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: step }, null).step,
      "payment-basics",
    );
    const manual = { active: true, manual: true, step };
    assert.deepEqual(initialTour({ onboardingStatus: "COMPLETED" }, manual), {
      ...manual,
      step: "payment-basics",
    });
  }
  assert.equal(
    initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: "payment-status" }, null).step,
    "issuance",
  );
});
test("payment tour chooses existing invoice links without making payments or inventing routes", () => {
  const route = "/invoices/12345678-1234-1234-1234-123456789abc";
  const selectors = [];
  const root = {
    querySelector(selector) {
      selectors.push(selector);
      return { getAttribute: () => route };
    },
  };
  assert.equal(paymentTourLink(root, true), route);
  assert.equal(selectors.pop(), 'a[data-tour-payment-invoice="record"]');
  assert.equal(paymentTourLink(root, false), route);
  assert.equal(selectors.pop(), "a[data-tour-payment-invoice]");
  assert.equal(paymentTourLink({ querySelector: () => null }, true), undefined);
  for (const bad of [
    undefined,
    "/invoices/new",
    "/invoices",
    "https://example.com",
    route + "/edit",
    "javascript:alert(1)",
  ])
    assert.equal(invoiceTourRoute(bad), undefined);
});
test("condensed payment step remains navigable in both directions", () => {
  const steps = tourSteps(["invoices:read", "invoices:record-payment"]);
  assert.equal(adjacentStep(steps, "payment-basics", 1), "bulk-exports");
  assert.equal(adjacentStep(steps, "payment-basics", -1), "issuance");
});
