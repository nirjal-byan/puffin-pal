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
  Reflect.defineMetadata(REQUIRED_PERMISSIONS, ["clients:read", "clients:create"], handler);
  assert.throws(() => guard.canActivate(context), ForbiddenException);
  Reflect.defineMetadata(REQUIRED_PERMISSIONS, ["clients:read"], handler);
  assert.equal(guard.canActivate(context), true);
});

test("only owners and admins have the dedicated invoice issuance permission", () => {
  for (const role of ["OWNER", "ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
    assert.equal(hasPermission(role, "invoices:issue"), role === "OWNER" || role === "ADMIN");
  }
});

test("employee directory and salary permissions remain separate", () => {
  assert.equal(hasPermission("PROJECT_MANAGER", "employees:read"), true);
  assert.equal(hasPermission("PROJECT_MANAGER", "salaries:read"), false);
  assert.equal(hasPermission("FINANCE_VIEWER", "employees:read"), true);
  assert.equal(hasPermission("FINANCE_VIEWER", "salaries:read"), true);
  assert.equal(hasPermission("FINANCE_VIEWER", "salaries:manage"), false);
  assert.equal(hasPermission("ADMIN", "salaries:manage"), true);
});

test("payroll access excludes project managers and keeps finance viewers read-only", () => {
  assert.equal(hasPermission("PROJECT_MANAGER", "payroll:read"), false);
  assert.equal(hasPermission("FINANCE_VIEWER", "payroll:read"), true);
  assert.equal(hasPermission("FINANCE_VIEWER", "payroll:manage"), false);
  assert.equal(hasPermission("OWNER", "payroll:finalize"), true);
  assert.equal(hasPermission("ADMIN", "payroll:payments:record"), true);
});

test("banking is restricted to finance roles with explicit write access", () => {
  assert.equal(hasPermission("PROJECT_MANAGER", "banking:read"), false);
  assert.equal(hasPermission("FINANCE_VIEWER", "banking:read"), true);
  assert.equal(hasPermission("FINANCE_VIEWER", "banking:manage"), false);
  assert.equal(hasPermission("OWNER", "banking:reconcile"), true);
  assert.equal(hasPermission("ADMIN", "banking:manage"), true);
});
