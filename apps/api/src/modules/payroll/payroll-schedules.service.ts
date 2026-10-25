import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Temporal } from "temporal-polyfill";
import type { AuthenticatedRequest } from "../../common/types/auth.types.js";
import { DATABASE } from "../../infrastructure/database/database.module.js";
import type { Database } from "../../infrastructure/database/client.js";
import type {
  CreatePayrollScheduleDto,
  PayrollHistoryQueryDto,
  UpdatePayrollScheduleDto,
} from "./payroll-schedule.dto.js";
import {
  assertScheduleStart,
  assertTimezone,
  schedulePeriod,
  utcDate,
} from "./payroll-schedule.js";
import { PayrollAutomationQueue } from "./payroll-automation.queue.js";

@Injectable({ scope: Scope.REQUEST })
export class PayrollSchedulesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    private readonly queue: PayrollAutomationQueue,
  ) {}
  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }
  private values(input: CreatePayrollScheduleDto) {
    try {
      assertTimezone(input.timezone);
      const start = assertScheduleStart(input.startDate, input.frequency);
      const period = schedulePeriod(start, input.frequency, input.generationTime, input.timezone);
      return {
        name: input.name.trim(),
        frequency: input.frequency,
        timezone: input.timezone,
        startDate: utcDate(start),
        nextPeriodStart: utcDate(start),
        periodAnchorDay: start.day,
        generationTime: input.generationTime,
        paymentOffsetDays: input.paymentOffsetDays ?? null,
        nextRunAt: period.scheduledFor,
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
  async list() {
    return this.db.orm.public.PayrollSchedule.where({
      organizationId: this.tenant.organizationId,
    }).all();
  }
  async get(id: string) {
    const schedule = await this.db.orm.public.PayrollSchedule.where({
      organizationId: this.tenant.organizationId,
      id,
    }).first();
    if (!schedule) throw new NotFoundException("Payroll schedule not found");
    return schedule;
  }
  async create(input: CreatePayrollScheduleDto) {
    const existing = await this.list();
    if (existing.length)
      throw new ConflictException("This organization already has a payroll schedule");
    try {
      return await this.db.transaction(async (tx) => {
        const schedule = await tx.orm.public.PayrollSchedule.create({
          organizationId: this.tenant.organizationId,
          createdById: this.tenant.userId,
          ...this.values(input),
        });
        await tx.orm.public.PayrollScheduleEvent.create({
          organizationId: this.tenant.organizationId,
          scheduleId: schedule.id,
          actorId: this.tenant.userId,
          action: "CREATED",
        });
        return schedule;
      });
    } catch (error) {
      if ((await this.list()).length)
        throw new ConflictException("This organization already has a payroll schedule");
      throw error;
    }
  }
  async update(id: string, input: UpdatePayrollScheduleDto) {
    const current = await this.get(id);
    const values = this.values(input);
    if (current.lastSuccessfulAt) {
      values.nextPeriodStart = current.nextPeriodStart;
      const next = schedulePeriod(
        current.nextPeriodStart,
        input.frequency,
        input.generationTime,
        input.timezone,
        values.periodAnchorDay,
      );
      values.nextRunAt = next.scheduledFor;
    }
    return this.db.transaction(async (tx) => {
      const [updated] = await tx.orm.public.PayrollSchedule.where({
        organizationId: this.tenant.organizationId,
        id,
        version: input.expectedVersion,
      }).updateAll({ ...values, version: input.expectedVersion + 1 });
      if (!updated) throw new ConflictException("Schedule changed. Reload and try again.");
      await tx.orm.public.PayrollScheduleEvent.create({
        organizationId: this.tenant.organizationId,
        scheduleId: id,
        actorId: this.tenant.userId,
        action: "UPDATED",
      });
      return updated;
    });
  }
  async transition(id: string, expectedVersion: number, target: "ACTIVE" | "PAUSED") {
    const schedule = await this.get(id);
    if (schedule.status === target)
      throw new ConflictException(`Payroll automation is already ${target.toLowerCase()}`);
    return this.db.transaction(async (tx) => {
      const [updated] = await tx.orm.public.PayrollSchedule.where({
        organizationId: this.tenant.organizationId,
        id,
        version: expectedVersion,
      }).updateAll({ status: target, version: expectedVersion + 1 });
      if (!updated) throw new ConflictException("Schedule changed. Reload and try again.");
      await tx.orm.public.PayrollScheduleEvent.create({
        organizationId: this.tenant.organizationId,
        scheduleId: id,
        actorId: this.tenant.userId,
        action: target === "ACTIVE" ? "RESUMED" : "PAUSED",
      });
      return updated;
    });
  }
  async history(id: string, query: PayrollHistoryQueryDto) {
    await this.get(id);
    let rows = await this.db.orm.public.PayrollScheduleOccurrence.where({
      organizationId: this.tenant.organizationId,
      scheduleId: id,
    }).all();
    if (query.status) rows = rows.filter((row) => row.status === query.status);
    rows.sort((a, b) => b.createdAt.toString().localeCompare(a.createdAt.toString()));
    return { items: rows.slice(query.offset, query.offset + query.limit), total: rows.length };
  }
  async generate(id: string) {
    const schedule = await this.get(id);
    if (schedule.status !== "ACTIVE") throw new ConflictException("Resume automation first");
    const failed = (
      await this.db.orm.public.PayrollScheduleOccurrence.where({
        organizationId: this.tenant.organizationId,
        scheduleId: id,
        status: "FAILED",
      }).all()
    ).sort((a, b) => b.createdAt.toString().localeCompare(a.createdAt.toString()))[0];
    if (failed) {
      await this.db.orm.public.PayrollScheduleOccurrence.where({
        organizationId: this.tenant.organizationId,
        id: failed.id,
        status: "FAILED",
      }).updateAll({ status: "PENDING", failureCode: null, failureMessage: null });
      await this.queue.enqueue(failed.id, this.tenant.organizationId);
      return { ...failed, status: "PENDING" as const };
    }
    if (Temporal.Instant.compare(schedule.nextRunAt, Temporal.Now.instant()) > 0)
      throw new ConflictException("The next payroll period is not eligible yet");
    const period = schedulePeriod(
      schedule.nextPeriodStart,
      schedule.frequency,
      schedule.generationTime,
      schedule.timezone,
      schedule.periodAnchorDay,
    );
    let occurrence = await this.db.orm.public.PayrollScheduleOccurrence.where({
      organizationId: this.tenant.organizationId,
      scheduleId: id,
      periodStart: utcDate(period.start),
    }).first();
    if (!occurrence) {
      try {
        occurrence = await this.db.orm.public.PayrollScheduleOccurrence.create({
          organizationId: this.tenant.organizationId,
          scheduleId: id,
          periodStart: utcDate(period.start),
          periodEnd: utcDate(period.end),
          scheduledFor: period.scheduledFor,
          source: "MANUAL",
        });
      } catch {
        occurrence = await this.db.orm.public.PayrollScheduleOccurrence.where({
          organizationId: this.tenant.organizationId,
          scheduleId: id,
          periodStart: utcDate(period.start),
        }).first();
      }
    }
    if (!occurrence) throw new ConflictException("Payroll generation could not be claimed");
    if (["GENERATED", "PROCESSING"].includes(occurrence.status)) return occurrence;
    await this.queue.enqueue(occurrence.id, this.tenant.organizationId);
    return { ...occurrence, status: "PENDING" as const };
  }
}
