import type { Role } from "@puffinpal/permissions";
import type { Request } from "express";

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: Role;
}
export interface AuthenticatedRequest extends Request {
  auth?: TenantContext;
}
