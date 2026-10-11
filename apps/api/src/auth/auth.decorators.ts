import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import type { Permission } from "@puffinpal/permissions";
import type { AuthenticatedRequest, TenantContext } from "./auth.types.js";

export const PUBLIC_ROUTE = "puffinpal:public";
export const REQUIRED_PERMISSIONS = "puffinpal:permissions";
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const tenant = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().auth;
    if (!tenant) throw new UnauthorizedException();
    return tenant;
  },
);
