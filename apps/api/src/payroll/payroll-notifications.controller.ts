import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import { Temporal } from "temporal-polyfill";

@ApiTags("payroll notifications")
@ApiBearerAuth()
@Controller("payroll/notifications")
export class PayrollNotificationsController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}
  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }
  @Get()
  @RequirePermissions("payroll:read")
  list() {
    return this.db.orm.public.PayrollNotification.where({
      organizationId: this.tenant.organizationId,
      recipientId: this.tenant.userId,
    })
      .orderBy((row) => row.createdAt.desc())
      .limit(50)
      .all();
  }
  @Patch(":id/read")
  @RequirePermissions("payroll:read")
  async read(@Param("id", ParseUUIDPipe) id: string) {
    const [notification] = await this.db.orm.public.PayrollNotification.where({
      organizationId: this.tenant.organizationId,
      recipientId: this.tenant.userId,
      id,
    }).updateAll({ readAt: Temporal.Now.instant() });
    if (!notification) throw new NotFoundException("Notification not found");
    return notification;
  }
}
