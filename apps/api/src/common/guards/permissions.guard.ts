import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission, type Permission } from "@puffinpal/permissions";
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from "../decorators/auth.decorators.js";
import type { AuthenticatedRequest } from "../types/auth.types.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) return true;
    const permissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS,
      targets,
    );
    const tenant = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
    // New protected routes must explicitly declare their permission policy.
    if (
      !tenant ||
      !permissions?.length ||
      !permissions.every((permission) => hasPermission(tenant.role, permission))
    ) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
