import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { isRole } from "@puffinpal/permissions";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import { PUBLIC_ROUTE } from "./auth.decorators.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? "");
    if (!match) throw new UnauthorizedException("Bearer token required");
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(match[1]);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (
      !payload ||
      typeof payload.sub !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.exp !== "number"
    ) {
      throw new UnauthorizedException("Invalid token claims");
    }
    const user = await this.db.orm.public.User.where({
      id: payload.sub,
      organizationId: payload.organizationId,
    })
      .select("id")
      .first();
    const membership = await this.db.orm.public.Membership.where({
      userId: payload.sub,
      organizationId: payload.organizationId,
    })
      .select("role")
      .first();
    if (!user || !membership || !isRole(membership.role))
      throw new UnauthorizedException("Membership is no longer valid");
    request.auth = Object.freeze({
      userId: user.id,
      organizationId: payload.organizationId,
      role: membership.role,
    });
    return true;
  }
}
