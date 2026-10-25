import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  SignupDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from "../dist/src/modules/auth/auth.dto.js";
import { AuthService } from "../dist/src/modules/auth/auth.service.js";
import { hashPassword, verifyPassword } from "../dist/src/modules/auth/password.js";

const tenant = { userId: "user-1", organizationId: "org-1", role: "OWNER" };
function setup(user) {
  const calls = [];
  const model = {
    where(filter) {
      calls.push(filter);
      return {
        select() {
          return this;
        },
        async first() {
          return user;
        },
        async update(data) {
          if (
            !user ||
            (filter.passwordHash && filter.passwordHash !== user.passwordHash)
          )
            return null;
          Object.assign(user, data);
          return { id: user.id };
        },
      };
    },
  };
  const db = {
    orm: {
      public: {
        User: model,
        Organization: {
          where: () => ({
            select: () => ({
              first: async () => ({ id: "org-1", currency: "USD" }),
            }),
          }),
        },
      },
    },
  };
  return { service: new AuthService(db, {}), calls };
}

test("password change rejects incorrect current password without writing", async () => {
  const user = {
    id: "user-1",
    passwordHash: await hashPassword("original-password-123"),
  };
  const original = user.passwordHash;
  const { service, calls } = setup(user);
  await assert.rejects(
    service.changePassword(tenant, {
      currentPassword: "wrong",
      newPassword: "replacement-password-123",
    }),
    /Current password is incorrect/,
  );
  assert.equal(user.passwordHash, original);
  assert.deepEqual(calls, [{ id: "user-1", organizationId: "org-1" }]);
});

test("password change scopes reads and writes to the tenant and stores a new hash", async () => {
  const user = {
    id: "user-1",
    passwordHash: await hashPassword("original-password-123"),
  };
  const original = user.passwordHash;
  const { service, calls } = setup(user);
  await service.changePassword(tenant, {
    currentPassword: "original-password-123",
    newPassword: "replacement-password-123",
  });
  assert.equal(
    await verifyPassword("replacement-password-123", user.passwordHash),
    true,
  );
  assert.equal(
    await verifyPassword("original-password-123", user.passwordHash),
    false,
  );
  assert.deepEqual(calls[1], {
    id: "user-1",
    organizationId: "org-1",
    passwordHash: original,
  });
});

test("profile update trims the name and never updates email or role", async () => {
  const user = { id: "user-1", fullName: "Before", email: "user@example.test" };
  const { service, calls } = setup(user);
  await service.updateProfile(tenant, {
    fullName: "  Updated Name  ",
    email: "other@example.test",
    role: "ADMIN",
  });
  assert.equal(user.fullName, "Updated Name");
  assert.equal(user.email, "user@example.test");
  assert.equal(user.role, undefined);
  assert.deepEqual(calls[0], { id: "user-1", organizationId: "org-1" });
});

test("settings DTOs reject short passwords and blank profile names", async () => {
  const errors = await validate(
    plainToInstance(ChangePasswordDto, {
      currentPassword: "current",
      newPassword: "short",
    }),
  );
  assert.ok(errors.some((error) => error.property === "newPassword"));
  assert.ok(
    (await validate(plainToInstance(UpdateProfileDto, { fullName: "   " })))
      .length,
  );
});

test("registration validates phone, website, employee range, currency, and name fields", async () => {
  const input = {
    organizationSlug: "test-company",
    organizationName: "Test",
    fullName: "Jane Doe",
    email: "jane@example.com",
    password: "secure-password-123",
    firstName: "Jane",
    lastName: "Doe",
    phoneNumber: "+12025550123",
    companyWebsite: "https://example.com",
    employeeCount: "11-50",
    currency: "NPR",
    confirmPassword: "secure-password-123",
  };
  assert.equal((await validate(plainToInstance(SignupDto, input))).length, 0);
  for (const [field, value] of [
    ["firstName", "   "],
    ["phoneNumber", "abc"],
    ["companyWebsite", "javascript:alert(1)"],
    ["employeeCount", "unknown"],
    ["currency", "BTC"],
  ]) {
    const errors = await validate(
      plainToInstance(SignupDto, { ...input, [field]: value }),
    );
    assert.ok(errors.some((error) => error.property === field));
  }
});
test("registration rejects mismatched confirmation and incomplete names before creating records", async () => {
  const service = new AuthService({}, {});
  await assert.rejects(
    service.signup({
      password: "secure-password-123",
      confirmPassword: "different-password",
    }),
    /Passwords do not match/,
  );
  await assert.rejects(
    service.signup({
      password: "secure-password-123",
      fullName: "Jane",
      firstName: "Jane",
    }),
    /First and last name are both required/,
  );
});
