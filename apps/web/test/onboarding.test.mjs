import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TOUR_STEPS,
  adjacentStep,
  initialTour,
  tourPosition,
  tourSteps,
  tourStorageKey,
  visibleTourTarget,
} from "../features/onboarding/tour.ts";

test("only newly registered users automatically start onboarding", () => {
  assert.equal(initialTour({ onboardingStatus: "PENDING" }, null).active, true);
  for (const onboardingStatus of [undefined, "LEGACY", "COMPLETED", "SKIPPED"])
    assert.equal(initialTour({ onboardingStatus }, null).active, false);
});

test("the tutorial stays brief and uses stable page-level targets", () => {
  assert.equal(TOUR_STEPS.length, 9);
  assert.equal(new Set(TOUR_STEPS.map(({ id }) => id)).size, TOUR_STEPS.length);
  assert.deepEqual(
    TOUR_STEPS.map(({ id }) => id),
    [
      "welcome",
      "overview",
      "billing",
      "spending",
      "cash-flow",
      "people",
      "payroll",
      "payroll-automation",
      "finish",
    ],
  );
  for (const step of TOUR_STEPS.filter(({ route }) => route)) {
    assert.ok(step.target, `${step.id} needs a stable target`);
    assert.ok(
      ["dashboard-summary", "page-heading", "cash-flow-overview", "payroll-overview"].includes(
        step.target,
      ),
      `${step.id} targets an unstable control`,
    );
  }
});

test("steps are permission scoped and navigation skips unavailable features", () => {
  assert.deepEqual(
    tourSteps([]).map(({ id }) => id),
    ["welcome", "overview", "finish"],
  );
  const billingViewer = tourSteps(["invoices:read"]);
  assert.deepEqual(
    billingViewer.map(({ id }) => id),
    ["welcome", "overview", "billing", "finish"],
  );
  assert.equal(adjacentStep(billingViewer, "billing", 1), "finish");
  assert.equal(adjacentStep(billingViewer, "billing", -1), "overview");
  assert.equal(adjacentStep(billingViewer, "welcome", -1), "welcome");
  assert.equal(adjacentStep(billingViewer, "finish", 1), "finish");
  assert.equal(
    tourSteps([
      "invoices:read",
      "expenses:read",
      "cash-flow:read",
      "employees:read",
      "payroll:read",
    ]).length,
    9,
  );
});

test("saved progress resumes and old detailed steps map to concise sections", () => {
  const saved = { active: true, manual: false, step: "billing" };
  assert.deepEqual(initialTour({ onboardingStatus: "PENDING" }, saved), saved);
  assert.equal(
    initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: "cash-flow" }, null).step,
    "cash-flow",
  );
  for (const [legacy, current] of [
    ["payment-history", "billing"],
    ["expense-approvals", "spending"],
    ["attendance", "people"],
    ["payroll-approval", "payroll"],
    ["settings", "finish"],
  ]) {
    assert.equal(
      initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: legacy }, null).step,
      current,
    );
  }
  assert.equal(
    initialTour({ onboardingStatus: "IN_PROGRESS", onboardingStep: "unknown" }, null).step,
    "welcome",
  );
  assert.equal(initialTour({ onboardingStatus: "COMPLETED" }, saved).active, false);
});

test("manual replay works without changing previous completion", () => {
  const replay = { active: true, manual: true, step: "welcome" };
  for (const onboardingStatus of ["LEGACY", "COMPLETED", "SKIPPED"])
    assert.deepEqual(initialTour({ onboardingStatus }, replay), replay);
  assert.equal(tourStorageKey("user-1"), "puffinpal-tour-v1:user-1");
  assert.notEqual(tourStorageKey("user-1"), tourStorageKey("user-2"));
});

test("missing, hidden and zero-size targets are unavailable", (t) => {
  globalThis.getComputedStyle = () => ({ display: "block", visibility: "visible" });
  t.after(() => delete globalThis.getComputedStyle);
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
});
