import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthService } from "../dist/src/auth/auth.service.js";
import { UpdateOnboardingDto } from "../dist/src/auth/onboarding.dto.js";

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
  assert.deepEqual(await service.updateOnboarding(tenant, { status: "IN_PROGRESS", step: "clients" }), { onboardingStatus: "IN_PROGRESS", onboardingStep: "clients" });
  await service.updateOnboarding(tenant, { status: "COMPLETED", step: "finish" });
  await service.updateOnboarding(tenant, { status: "IN_PROGRESS", step: "welcome" });
  assert.equal(user.onboardingStatus, "COMPLETED");
  for (const filter of filters) { assert.equal(filter.id, tenant.userId); assert.equal(filter.organizationId, tenant.organizationId); }
  for (const status of ["LEGACY", "SKIPPED"]) {
    user.onboardingStatus = status;
    await service.updateOnboarding(tenant, { status: "IN_PROGRESS", step: "welcome" });
    assert.equal(user.onboardingStatus, status);
  }
});
