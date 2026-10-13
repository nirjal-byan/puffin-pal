import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialTour, tourSteps, tourStorageKey, adjacentStep, tourPosition, visibleTourTarget,
  invoiceTourRoute, paymentTourLink, paymentTourWaiting,
} from "../features/onboarding/tour.ts";

test("payment steps wait for invoice data instead of treating loading as missing controls", () => {
  let loading = true;
  const root = { querySelector(selector) {
    assert.equal(selector, '.workspace-main .panel.loading[role="status"]');
    return loading ? {} : null;
  } };
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
  assert.equal(initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: "clients" }, null).step, "clients");
  assert.equal(initialTour({ onboardingStatus: "COMPLETED" }, saved).active, false);
  assert.equal(initialTour({ onboardingStatus: "SKIPPED" }, saved).active, false);
  assert.equal(initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: "bad" }, null).step, "welcome");
  assert.equal(initialTour({ onboardingStatus: "PENDING" }, { active: true, step: "bad", manual: false }).step, "welcome");
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
  assert.ok(!viewer.some((step) => /payroll|expenses|payment tracking/i.test(step.title)));
});
test("missing, hidden and zero-size targets are unavailable", (t) => {
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  t.after(() => { delete globalThis.getComputedStyle; });
  const target = { closest: () => null, getBoundingClientRect: () => ({ width: 40, height: 30 }) };
  assert.equal(visibleTourTarget(null), false);
  assert.equal(visibleTourTarget(target), true);
  assert.equal(visibleTourTarget({ ...target, closest: () => ({}) }), false);
  assert.equal(visibleTourTarget({ ...target, getBoundingClientRect: () => ({ width: 0, height: 30 }) }), false);
  t.mock.method(globalThis, "getComputedStyle", () => ({ display: "none", visibility: "visible" }));
  assert.equal(visibleTourTarget(target), false);
});
test("popover remains inside desktop, mobile and short viewports", () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 360, height: 640 }, { width: 320, height: 300 }]) {
    for (const target of [null, { left: 20, top: 80, width: 120, height: 40 }, { left: viewport.width - 80, top: viewport.height - 50, width: 60, height: 30 }]) {
      const panel = { width: 360, height: 260 };
      const position = tourPosition(target, viewport, panel);
      assert.ok(position.left >= 12);
      assert.ok(position.top >= 12);
      assert.ok(position.left + position.width <= viewport.width - 12);
      assert.ok(position.top + Math.min(panel.height, viewport.height - 24) <= viewport.height - 12);
    }
  }
  const target = { left: 20, top: 80, width: 120, height: 40 };
  assert.ok(tourPosition(target, { width: 1440, height: 900 }, { width: 360, height: 260 }).left > target.left + target.width);
});

test("payment explanations follow permissions for readers and payment recorders", () => {
  const reader = tourSteps(["invoices:read"]);
  for (const id of ["payment-balance", "payment-history", "payment-status"])
    assert.ok(reader.some((step) => step.id === id));
  for (const id of ["payment-basics", "record-payment"])
    assert.ok(!reader.some((step) => step.id === id));
  const writer = tourSteps(["invoices:read", "invoices:record-payment"]);
  assert.equal(writer.find((step) => step.id === "record-payment").target, "record-payment");
  assert.ok(writer.find((step) => step.id === "record-payment").detail);
  assert.ok(!tourSteps([]).some((step) => step.id.startsWith("payment-") || step.id === "record-payment"));
});
test("old progress and completion survive new steps, which also resume during manual replay", () => {
  const old = { active: true, manual: false, step: "team" };
  assert.deepEqual(initialTour({ onboardingStatus: "IN_PROGRESS" }, old), old);
  assert.equal(initialTour({ onboardingStatus: "PENDING" }, null).step, "welcome");
  for (const status of ["LEGACY", "COMPLETED", "SKIPPED"])
    assert.equal(initialTour({ onboardingStatus: status }, null).active, false);
  for (const step of ["payment-basics", "record-payment", "payment-balance", "payment-history", "payment-status"]) {
    assert.equal(initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: step }, null).step, step);
    const manual = { active: true, manual: true, step };
    assert.deepEqual(initialTour({ onboardingStatus: "COMPLETED" }, manual), manual);
  }
});
test("payment tour chooses existing invoice links without making payments or inventing routes", () => {
  const route = "/invoices/12345678-1234-1234-1234-123456789abc";
  const selectors = [];
  const root = { querySelector(selector) { selectors.push(selector); return { getAttribute: () => route }; } };
  assert.equal(paymentTourLink(root, true), route);
  assert.equal(selectors.pop(), 'a[data-tour-payment-invoice="record"]');
  assert.equal(paymentTourLink(root, false), route);
  assert.equal(selectors.pop(), "a[data-tour-payment-invoice]");
  assert.equal(paymentTourLink({ querySelector: () => null }, true), undefined);
  for (const bad of [undefined, "/invoices/new", "/invoices", "https://example.com", route + "/edit", "javascript:alert(1)"])
    assert.equal(invoiceTourRoute(bad), undefined);
});
test("missing payment steps can be skipped in either direction without trapping Back", () => {
  const steps = tourSteps(["invoices:read", "invoices:record-payment"]);
  assert.equal(adjacentStep(steps, "record-payment", 1), "payment-balance");
  assert.equal(adjacentStep(steps, "record-payment", -1), "payment-basics");
  assert.equal(adjacentStep(steps, "payment-history", 1), "payment-status");
  assert.equal(adjacentStep(tourSteps(["invoices:read"]), "record-payment", 1), "payment-balance");
});
