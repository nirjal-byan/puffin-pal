export const ROLES = ["OWNER", "ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"] as const;
export type Role = (typeof ROLES)[number];
export const PERMISSIONS = [
  "profile:read",
  "organization:read",
  "organization:update",
  "members:read",
  "members:manage",
  "employees:read",
  "employees:create",
  "employees:update",
  "employees:manage",
  "salaries:read",
  "salaries:manage",
  "clients:read",
  "clients:create",
  "clients:update",
  "clients:delete",
  "invoices:read",
  "invoices:create",
  "invoices:update",
  "invoices:delete",
  "invoices:issue",
  "invoices:record-payment",
  "expenses:read",
  "expenses:create",
  "expenses:update",
  "expenses:delete",
  "expenses:submit",
  "expenses:approve",
  "retainers:read",
  "retainers:create",
  "retainers:update",
  "retainers:delete",
  "payroll:read",
  "payroll:create",
  "payroll:manage",
  "payroll:approve",
  "payroll:finalize",
  "payroll:payments:record",
  "cash-flow:read",
  "cash-flow:manage",
  "banking:read",
  "banking:manage",
  "banking:reconcile",
  "attendance:read",
  "attendance:manage",
  "attendance:self",
  "leave:read",
  "leave:request",
  "leave:approve",
  "leave:manage",
  "overtime:read",
  "overtime:request",
  "overtime:approve",
  "overtime:manage",
  "workforce:calendar:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const readPermissions: readonly Permission[] = [
  "profile:read",
  "organization:read",
  "employees:read",
  "clients:read",
  "invoices:read",
  "expenses:read",
  "retainers:read",
  "attendance:read",
  "attendance:self",
  "leave:read",
  "leave:request",
  "overtime:read",
  "overtime:request",
  "workforce:calendar:read",
  "cash-flow:read",
];
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  OWNER: Object.freeze([...PERMISSIONS]),
  ADMIN: Object.freeze([...PERMISSIONS]),
  PROJECT_MANAGER: Object.freeze([
    ...readPermissions,
    "clients:create",
    "clients:update",
    "invoices:create",
    "invoices:update",
    "expenses:create",
    "expenses:update",
    "expenses:submit",
    "retainers:create",
    "retainers:update",
    "attendance:manage",
    "leave:approve",
    "overtime:approve",
  ] as Permission[]),
  FINANCE_VIEWER: Object.freeze([
    ...readPermissions,
    "banking:read",
    "salaries:read",
    "payroll:read",
  ] as Permission[]),
});
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.some((role) => role === value);
}
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
// An administrator may provision operational roles; only an owner may provision administrators.
// Ownership transfer is deliberately not part of this helper or the public signup payload.
export function canAssignRole(actor: Role, target: Role): boolean {
  return actor === "OWNER"
    ? target !== "OWNER"
    : actor === "ADMIN" && (target === "PROJECT_MANAGER" || target === "FINANCE_VIEWER");
}
