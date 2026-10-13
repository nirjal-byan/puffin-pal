export const ROLES = [
  "OWNER",
  "ADMIN",
  "PROJECT_MANAGER",
  "FINANCE_VIEWER",
] as const;
export type Role = (typeof ROLES)[number];
export const PERMISSIONS = [
  "profile:read",
  "organization:read",
  "organization:update",
  "members:read",
  "members:manage",
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
  "retainers:read",
  "retainers:create",
  "retainers:update",
  "retainers:delete",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const readPermissions: readonly Permission[] = [
  "profile:read",
  "organization:read",
  "clients:read",
  "invoices:read",
  "expenses:read",
  "retainers:read",
];
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> =
  Object.freeze({
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
      "retainers:create",
      "retainers:update",
    ] as Permission[]),
    FINANCE_VIEWER: Object.freeze([...readPermissions]),
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
    : actor === "ADMIN" &&
        (target === "PROJECT_MANAGER" || target === "FINANCE_VIEWER");
}
