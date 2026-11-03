import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthService } from "../dist/src/modules/auth/auth.service.js";
import { TOUR_STEPS, adjacentStep, initialTour } from "../../web/src/features/onboarding/tour.ts";
import { UpdateOnboardingDto } from "../dist/src/modules/auth/onboarding.dto.js";

test("onboarding accepts payment steps while preserving all existing step identifiers", async () => {
  for (const step of ["welcome", "dashboard", "clients", "invoices", "create-invoice", "issuance", "team", "settings", "finish",
    "payment-basics", "record-payment", "payment-balance", "payment-history", "payment-status"]) {
    assert.equal((await validate(plainToInstance(UpdateOnboardingDto, { status: "IN_PROGRESS", step }))).length, 0);
  }
});

test("onboarding input only accepts supported statuses/steps and rejects identity overrides", async () => {
  for (const data of [
    {}, { status: "LEGACY", step: "welcome" }, { status: "PENDING", step: "welcome" },
    { status: "IN_PROGRESS", step: "payments" }, { status: "COMPLETED", step: "finish", userId: "other" },
  ]) assert.ok((await validate(plainToInstance(UpdateOnboardingDto, data), { whitelist: true, forbidNonWhitelisted: true })).length);
  assert.equal((await validate(plainToInstance(UpdateOnboardingDto, { status: "SKIPPED", step: "clients" }))).length, 0);
});
test("updates are scoped to authenticated identity and terminal statuses cannot be reset", async () => {
  const user = { onboardingStatus: "PENDING", onboardingStep: "welcome" };
  const filters = [];
  const service = new AuthService({ orm: { public: { User: {
    where(filter) {
      filters.push(filter);
      return {
        where(predicate) {
          predicate({ onboardingStatus: { in: (statuses) => { filter.statuses = statuses; } } });
          return this;
        },
        select() { return this; }, async first() { return { ...user }; },
        async updateAll(data) {
          if (filter.statuses.includes(user.onboardingStatus)) Object.assign(user, data);
          return [];
        },
      };
    },
  } } } }, {});
  const tenant = { userId: "user-1", organizationId: "org-1" };
  assert.deepEqual(await service.updateOnboarding(tenant, { status: "IN_PROGRESS", step: "billing" }), { onboardingStatus: "IN_PROGRESS", onboardingStep: "billing" });
  assert.deepEqual(await service.updateOnboarding(tenant, { status: "IN_PROGRESS", step: "overview" }), { onboardingStatus: "IN_PROGRESS", onboardingStep: "overview" });
  await service.updateOnboarding(tenant, { status: "COMPLETED", step: "finish" });
  await service.updateOnboarding(tenant, { status: "IN_PROGRESS", step: "welcome" });
  assert.equal(user.onboardingStatus, "COMPLETED");
  for (const filter of filters) { assert.equal(filter.id, tenant.userId); assert.equal(filter.organizationId, tenant.organizationId); }
  user.onboardingStatus = "IN_PROGRESS";
  assert.deepEqual(await service.updateOnboarding(tenant, { status: "SKIPPED", step: "payroll" }), { onboardingStatus: "SKIPPED", onboardingStep: "payroll" });
  for (const status of ["LEGACY", "SKIPPED"]) {
    user.onboardingStatus = status;
    await service.updateOnboarding(tenant, { status: "IN_PROGRESS", step: "welcome" });
    assert.equal(user.onboardingStatus, status);
  }
});

// Exercise the actual UI definitions against request validation rather than duplicating
// the current step list here: adding a frontend step must keep this contract passing.
test("every frontend step is accepted for progress, skip and completion", async () => {
  for (const { id: step } of TOUR_STEPS) {
    for (const status of ["IN_PROGRESS", "SKIPPED", "COMPLETED"]) {
      assert.deepEqual(await validate(plainToInstance(UpdateOnboardingDto, { status, step })), [], `${status}: ${step}`);
    }
  }
});

test("new users can start and navigate the current tour in both directions", async () => {
  const initial = initialTour({ onboardingStatus: "PENDING" }, null);
  assert.equal(initial.active, true);
  assert.equal(initial.step, "welcome");
  const next = adjacentStep(TOUR_STEPS, initial.step, 1);
  assert.equal(next, "overview");
  assert.deepEqual(await validate(plainToInstance(UpdateOnboardingDto, { status: "IN_PROGRESS", step: next })), []);
  assert.equal(adjacentStep(TOUR_STEPS, next, -1), "welcome");
});
