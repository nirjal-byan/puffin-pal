import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Reflector } from "@nestjs/core";
import { ForbiddenException } from "@nestjs/common";
import { hasPermission, canAssignRole, isRole } from "@puffinpal/permissions";
import { PermissionsGuard } from "../dist/src/auth/permissions.guard.js";
import { REQUIRED_PERMISSIONS } from "../dist/src/auth/auth.decorators.js";

test("operational roles cannot delete records or manage members; viewers cannot write", () => {
  assert.equal(hasPermission("OWNER", "members:manage"), true);
  assert.equal(hasPermission("ADMIN", "members:manage"), true);
  assert.equal(hasPermission("PROJECT_MANAGER", "clients:create"), true);
  assert.equal(hasPermission("PROJECT_MANAGER", "clients:delete"), false);
  assert.equal(hasPermission("PROJECT_MANAGER", "members:manage"), false);
  assert.equal(hasPermission("FINANCE_VIEWER", "invoices:read"), true);
  assert.equal(hasPermission("FINANCE_VIEWER", "clients:create"), false);
  assert.equal(canAssignRole("ADMIN", "ADMIN"), false);
  assert.equal(canAssignRole("OWNER", "ADMIN"), true);
  assert.equal(canAssignRole("OWNER", "OWNER"), false);
  assert.equal(isRole("toString"), false);
});
test("protected routes fail closed without a policy and require every permission", () => {
  const handler = () => {};
  const context = {
    getHandler: () => handler,
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ auth: { role: "FINANCE_VIEWER" } }),
    }),
  };
  const guard = new PermissionsGuard(new Reflector());
  assert.throws(() => guard.canActivate(context), ForbiddenException);
  Reflect.defineMetadata(
    REQUIRED_PERMISSIONS,
    ["clients:read", "clients:create"],
    handler,
  );
  assert.throws(() => guard.canActivate(context), ForbiddenException);
  Reflect.defineMetadata(REQUIRED_PERMISSIONS, ["clients:read"], handler);
  assert.equal(guard.canActivate(context), true);
});
