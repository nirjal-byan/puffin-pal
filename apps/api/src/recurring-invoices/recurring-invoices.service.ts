import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type { PageDto } from "../tenancy/page.dto.js";
import { calculateInvoice } from "../invoices/utils/invoice-calculations.js";
import type { CreateRecurringInvoiceDto, UpdateRecurringInvoiceDto } from "./recurring-invoice.dto.js";
import { initialOccurrence } from "./recurring-schedule.js";
import { RecurringInvoiceQueue } from "./recurring-invoice.queue.js";

@Injectable({ scope: Scope.REQUEST })
export class RecurringInvoicesService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(REQUEST) private readonly request: AuthenticatedRequest, private readonly queue: RecurringInvoiceQueue) {}
  private get tenant() { if (!this.request.auth) throw new UnauthorizedException(); return this.request.auth; }
  async list(page: PageDto) {
    const organizationId = this.tenant.organizationId;
    const schedules = await this.db.orm.public.RecurringInvoiceSchedule.where({ organizationId }).orderBy((row) => row.createdAt.desc()).limit(page.limit).offset(page.offset).all();
    return Promise.all(schedules.map(async (schedule) => {
      const [client, items] = await Promise.all([this.db.orm.public.Client.where({ organizationId, id: schedule.clientId }).select("name").first(), this.db.orm.public.RecurringInvoiceItem.where({ organizationId, scheduleId: schedule.id }).orderBy((row) => row.position.asc()).all()]);
      return { ...schedule, clientName: client?.name ?? "Unavailable client", amount: calculateInvoice(items).total };
    }));
  }
  async get(id: string) {
    const organizationId = this.tenant.organizationId;
    const schedule = await this.db.orm.public.RecurringInvoiceSchedule.where({ organizationId, id }).first();
    if (!schedule) throw new NotFoundException("Recurring schedule not found");
    const [items, events] = await Promise.all([this.db.orm.public.RecurringInvoiceItem.where({ organizationId, scheduleId: id }).orderBy((row) => row.position.asc()).all(), this.db.orm.public.RecurringScheduleEvent.where({ organizationId, scheduleId: id }).orderBy((row) => row.createdAt.desc()).limit(100).all()]);
    return { ...schedule, items, events };
  }
  async create(input: CreateRecurringInvoiceDto) {
    const { organizationId, userId } = this.tenant;
    if (input.autoIssue && !["OWNER", "ADMIN"].includes(this.tenant.role)) throw new ForbiddenException("Automatic issuance requires invoice issuance access");
    const calculated = calculateInvoice(input.items);
    const nextRunAt = initialOccurrence(input.startDate);
    const endDate = input.endDate ? initialOccurrence(input.endDate) : null;
    if (endDate && endDate.epochMilliseconds < nextRunAt.epochMilliseconds) throw new BadRequestException("End date must be on or after start date");
    return this.db.transaction(async (tx) => {
      const [client, organization] = await Promise.all([
        tx.orm.public.Client.where({ organizationId, id: input.clientId }).select("id").first(),
        tx.orm.public.Organization.where({ id: organizationId }).select("currency").first(),
      ]);
      if (!client) throw new NotFoundException("Client not found");
      if (!organization) throw new NotFoundException("Organization not found");
      const schedule = await tx.orm.public.RecurringInvoiceSchedule.create({ organizationId, clientId: client.id, createdById: userId, name: input.name.trim(), description: input.description?.trim() || null, frequency: input.frequency, interval: input.interval, startDate: nextRunAt, endDate, nextRunAt, currency: organization.currency, dueDateOffsetDays: input.dueDateOffsetDays, autoIssue: input.autoIssue });
      for (const [position, item] of calculated.items.entries()) await tx.orm.public.RecurringInvoiceItem.create({ organizationId, scheduleId: schedule.id, ...item, position });
      await tx.orm.public.RecurringScheduleEvent.create({ organizationId, scheduleId: schedule.id, actorId: userId, action: "CREATED" });
      return { ...schedule, items: calculated.items };
    });
  }
  async update(id: string, input: UpdateRecurringInvoiceDto) {
    const organizationId = this.tenant.organizationId;
    if (input.autoIssue && !["OWNER", "ADMIN"].includes(this.tenant.role)) throw new ForbiddenException("Automatic issuance requires invoice issuance access");
    const calculated = calculateInvoice(input.items);
    return this.db.transaction(async (tx) => {
      const current = await tx.orm.public.RecurringInvoiceSchedule.where({ organizationId, id }).first();
      if (!current) throw new NotFoundException("Recurring schedule not found");
      if (["CANCELLED", "COMPLETED"].includes(current.status)) throw new ConflictException("This schedule can no longer be edited");
      const client = await tx.orm.public.Client.where({ organizationId, id: input.clientId }).select("id").first();
      if (!client) throw new NotFoundException("Client not found");
      const startDate = initialOccurrence(input.startDate); const endDate = input.endDate ? initialOccurrence(input.endDate) : null;
      const [schedule] = await tx.orm.public.RecurringInvoiceSchedule.where({ organizationId, id, version: input.expectedVersion }).updateAll({ clientId: client.id, name: input.name.trim(), description: input.description?.trim() || null, frequency: input.frequency, interval: input.interval, startDate, endDate, nextRunAt: current.lastRunAt ? current.nextRunAt : startDate, dueDateOffsetDays: input.dueDateOffsetDays, autoIssue: input.autoIssue, version: input.expectedVersion + 1 });
      if (!schedule) throw new ConflictException("Schedule changed. Reload and try again.");
      await tx.orm.public.RecurringInvoiceItem.where({ organizationId, scheduleId: id }).deleteAll();
      for (const [position, item] of calculated.items.entries()) await tx.orm.public.RecurringInvoiceItem.create({ organizationId, scheduleId: id, ...item, position });
      await tx.orm.public.RecurringScheduleEvent.create({ organizationId, scheduleId: id, actorId: this.tenant.userId, action: "UPDATED" });
      return { ...schedule, items: calculated.items };
    });
  }
  async transition(id: string, expectedVersion: number, target: "ACTIVE" | "PAUSED" | "CANCELLED") {
    const organizationId = this.tenant.organizationId;
    const current = await this.db.orm.public.RecurringInvoiceSchedule.where({ organizationId, id }).first();
    if (!current) throw new NotFoundException("Recurring schedule not found");
    const valid = (target === "PAUSED" && current.status === "ACTIVE") || (target === "ACTIVE" && current.status === "PAUSED") || (target === "CANCELLED" && ["ACTIVE", "PAUSED"].includes(current.status));
    if (!valid) throw new ConflictException(`Cannot change ${current.status} schedule to ${target}`);
    const [updated] = await this.db.orm.public.RecurringInvoiceSchedule.where({ organizationId, id, version: expectedVersion }).updateAll({ status: target, version: expectedVersion + 1 });
    if (!updated) throw new ConflictException("Schedule changed. Reload and try again.");
    await this.db.orm.public.RecurringScheduleEvent.create({ organizationId, scheduleId: id, actorId: this.tenant.userId, action: target === "ACTIVE" ? "RESUMED" : target === "PAUSED" ? "PAUSED" : "CANCELLED" });
    return updated;
  }
  async occurrences(id: string) { await this.get(id); return this.db.orm.public.RecurringInvoiceOccurrence.where({ organizationId: this.tenant.organizationId, scheduleId: id }).orderBy((row) => row.scheduledFor.desc()).limit(100).all(); }
  async retry(id: string, occurrenceId: string) {
    const organizationId = this.tenant.organizationId;
    const [occurrence] = await this.db.orm.public.RecurringInvoiceOccurrence.where({ organizationId, scheduleId: id, id: occurrenceId, status: "FAILED" }).updateAll({ status: "PENDING", failureCode: null });
    if (!occurrence) throw new NotFoundException("Failed occurrence not found");
    await this.db.orm.public.RecurringScheduleEvent.create({ organizationId, scheduleId: id, actorId: this.tenant.userId, action: "RETRIED", details: occurrence.id });
    await this.queue.enqueueOccurrence(occurrence.id, organizationId); return { status: "PENDING" };
  }
}
