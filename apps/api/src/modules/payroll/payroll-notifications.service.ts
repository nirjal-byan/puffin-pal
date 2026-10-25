import { Inject, Injectable } from "@nestjs/common";
import type { Database } from "../../infrastructure/database/client.js";
import { DATABASE } from "../../infrastructure/database/database.module.js";

@Injectable()
export class PayrollNotificationsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async notifyManagers(
    organizationId: string,
    type: "DRAFT_READY" | "APPROVAL_PENDING" | "AUTOMATION_FAILED" | "PAYSLIPS_READY",
    dedupeKey: string,
    title: string,
    message: string,
  ) {
    const memberships = await this.db.orm.public.Membership.where({ organizationId }).all();
    for (const membership of memberships.filter((row) => ["OWNER", "ADMIN"].includes(row.role))) {
      const existing = await this.db.orm.public.PayrollNotification.where({
        organizationId,
        recipientId: membership.userId,
        dedupeKey,
      }).first();
      if (existing) continue;
      await this.db.orm.public.PayrollNotification.create({
        organizationId,
        recipientId: membership.userId,
        type,
        dedupeKey,
        title,
        message,
        href: "/?section=payroll",
      }).catch(() => undefined);
    }
  }
}
