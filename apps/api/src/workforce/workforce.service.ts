import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type {
  AttendanceDto,
  AttendanceCorrectionDto,
  HolidayDto,
  LeaveAccrualPolicyDto,
  LeaveAccrualRunDto,
  LeaveBalanceAdjustmentDto,
  LeaveRequestDto,
  LeaveTypeDto,
  OvertimeRequestDto,
  ReviewLeaveDto,
  ReviewOvertimeDto,
  ReviewAttendanceCorrectionDto,
  WorkforceCalendarQueryDto,
  WorkforceQueryDto,
  WorkforceSettingsDto,
  WorkScheduleDto,
} from "./workforce.dto.js";
import {
  attendanceMetrics,
  dateInstant,
  DEFAULT_WORKDAYS,
  minutesBetween,
  workingLeaveUnits,
} from "./workforce-rules.js";
import {
  accrualPeriods,
  cappedAccrual,
  carryForwardMinutes,
  expirableCarryForward,
} from "./leave-accrual.js";

type OrmDatabase = Pick<Database, "orm">;

@Injectable({ scope: Scope.REQUEST })
export class WorkforceService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}

  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }
  private get organizationId() {
    return this.tenant.organizationId;
  }
  private day(value: { toString(): string }) {
    return value.toString().slice(0, 10);
  }
  private rate(value?: string | null) {
    return value ? (Number(value).toFixed(4) as Numeric<14, 4>) : null;
  }
  private multiplier(value?: string | null) {
    return value ? (Number(value).toFixed(4) as Numeric<8, 4>) : null;
  }
  private async employee(id: string) {
    const employee = await this.db.orm.public.Employee.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!employee) throw new NotFoundException("Employee not found");
    return employee;
  }
  private async linkedEmployee() {
    const employee = await this.db.orm.public.Employee.where({
      organizationId: this.organizationId,
      linkedUserId: this.tenant.userId,
    }).first();
    if (!employee) throw new ForbiddenException("Your account is not linked to an employee");
    return employee;
  }
  private async assertEmployeeAccess(employeeId: string, selfService: boolean) {
    const employee = await this.employee(employeeId);
    if (!selfService) return employee;
    const linked = await this.linkedEmployee();
    if (linked.id !== employeeId)
      throw new ForbiddenException("You can only access your own record");
    return employee;
  }
  private async assertReviewScope(employeeId: string) {
    const employee = await this.employee(employeeId);
    if (this.tenant.role === "PROJECT_MANAGER") {
      const manager = await this.linkedEmployee();
      if (employee.managerId !== manager.id)
        throw new ForbiddenException("You can only review requests from your direct reports");
    }
    return employee;
  }
  private audit(
    employeeId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    details?: unknown,
    tx: OrmDatabase = this.db,
  ) {
    return tx.orm.public.WorkforceAuditEvent.create({
      organizationId: this.organizationId,
      employeeId: employeeId ?? undefined,
      actorId: this.tenant.userId,
      entityType,
      entityId,
      action,
      details: details === undefined ? null : JSON.stringify(details),
    });
  }
  private async scheduleFor(employeeId: string, date: string) {
    const schedules = await this.db.orm.public.WorkSchedule.where({
      organizationId: this.organizationId,
      employeeId,
    }).all();
    return schedules
      .filter(
        (row) =>
          (row.isActive || Boolean(row.effectiveTo)) &&
          this.day(row.effectiveFrom) <= date &&
          (!row.effectiveTo || this.day(row.effectiveTo) >= date),
      )
      .sort((a, b) => this.day(b.effectiveFrom).localeCompare(this.day(a.effectiveFrom)))[0];
  }
  private validTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException("Provide a valid IANA timezone");
    }
  }

  private async assertSchedulePeriodMutable(from: string, to?: string) {
    const finalized = await this.db.orm.public.PayrollRun.where({
      organizationId: this.organizationId,
      status: "FINALIZED",
    }).all();
    if (
      finalized.some(
        (run) =>
          this.day(run.periodStart) <= (to ?? "9999-12-31") && this.day(run.periodEnd) >= from,
      )
    )
      throw new ConflictException("This schedule period overlaps finalized payroll");
  }

  async settings() {
    const organization = await this.db.orm.public.Organization.where({
      id: this.organizationId,
    })
      .select("timezone", "unpaidLeaveDeductionsEnabled")
      .first();
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async updateSettings(input: WorkforceSettingsDto) {
    this.validTimezone(input.timezone);
    const before = await this.settings();
    const organization = await this.db.orm.public.Organization.where({
      id: this.organizationId,
    }).update({
      timezone: input.timezone,
      unpaidLeaveDeductionsEnabled: input.unpaidLeaveDeductionsEnabled,
    });
    await this.audit(null, "WORKFORCE_SETTINGS", this.organizationId, "UPDATED", {
      timezone: { before: before.timezone, after: input.timezone },
      unpaidLeaveDeductionsEnabled: input.unpaidLeaveDeductionsEnabled,
    });
    return organization;
  }

  async attendance(query: WorkforceQueryDto, selfOnly = false) {
    const self = selfOnly ? await this.linkedEmployee() : null;
    let rows = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
    }).all();
    const employeeId = self?.id ?? query.employeeId;
    if (employeeId) rows = rows.filter((row) => row.employeeId === employeeId);
    if (!selfOnly && this.tenant.role === "PROJECT_MANAGER") {
      const manager = await this.linkedEmployee();
      const reports = await this.db.orm.public.Employee.where({
        organizationId: this.organizationId,
        managerId: manager.id,
      }).all();
      const allowed = new Set([manager.id, ...reports.map((employee) => employee.id)]);
      rows = rows.filter((row) => allowed.has(row.employeeId));
    }
    if (query.from) rows = rows.filter((row) => this.day(row.workDate) >= query.from!);
    if (query.to) rows = rows.filter((row) => this.day(row.workDate) <= query.to!);
    if (query.status) rows = rows.filter((row) => row.status === query.status);
    rows.sort((a, b) => this.day(b.workDate).localeCompare(this.day(a.workDate)));
    return rows;
  }

  async recordAttendance(input: AttendanceDto) {
    await this.employee(input.employeeId);
    const existing = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
      employeeId: input.employeeId,
      workDate: dateInstant(input.workDate),
    }).first();
    if (!existing) {
      const created = await this.db.orm.public.AttendanceRecord.create({
        organizationId: this.organizationId,
        employeeId: input.employeeId,
        workDate: dateInstant(input.workDate),
        status: input.status,
        workedMinutes: input.workedMinutes ?? null,
        isLate: input.isLate ?? false,
        notes: input.notes?.trim() || null,
        source: "MANUAL",
        createdById: this.tenant.userId,
        updatedById: this.tenant.userId,
      });
      await this.audit(input.employeeId, "ATTENDANCE", created.id, "CREATED");
      return created;
    }
    if (!input.expectedVersion || input.expectedVersion !== existing.version)
      throw new ConflictException("Attendance changed. Reload and try again.");
    const [updated] = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
      id: existing.id,
      version: input.expectedVersion,
    }).updateAll({
      status: input.status,
      workedMinutes: input.workedMinutes ?? null,
      isLate: input.isLate ?? false,
      notes: input.notes?.trim() || null,
      updatedById: this.tenant.userId,
      version: input.expectedVersion + 1,
    });
    if (!updated) throw new ConflictException("Attendance changed. Reload and try again.");
    await this.audit(input.employeeId, "ATTENDANCE", existing.id, "CORRECTED", {
      version: updated.version,
    });
    return updated;
  }

  async checkIn() {
    const employee = await this.linkedEmployee();
    if (employee.status !== "ACTIVE")
      throw new ConflictException("Only active employees can check in");
    const now = Temporal.Now.instant();
    const organization = await this.db.orm.public.Organization.where({
      id: this.organizationId,
    }).first();
    const schedule = await this.scheduleFor(employee.id, now.toString().slice(0, 10));
    const timezone = schedule?.timezone ?? organization?.timezone ?? "UTC";
    const localDate = now.toZonedDateTimeISO(timezone).toPlainDate().toString();
    const existing = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
      employeeId: employee.id,
      workDate: dateInstant(localDate),
    }).first();
    if (existing?.checkInAt && !existing.checkOutAt)
      throw new ConflictException("You are already checked in");
    if (existing?.checkOutAt)
      throw new ConflictException("Attendance is already completed for this workday");
    let isLate = false;
    if (schedule) {
      const [hour, minute] = schedule.scheduledStartTime.split(":").map(Number);
      const scheduled = now
        .toZonedDateTimeISO(timezone)
        .with({ hour, minute, second: 0, millisecond: 0 });
      isLate = Temporal.Instant.compare(now, scheduled.toInstant()) > 0;
    }
    const record = existing
      ? await this.db.orm.public.AttendanceRecord.where({
          organizationId: this.organizationId,
          id: existing.id,
        }).update({
          status: "PRESENT",
          checkInAt: now,
          isLate,
          source: "SELF_SERVICE",
          updatedById: this.tenant.userId,
          version: existing.version + 1,
        })
      : await this.db.orm.public.AttendanceRecord.create({
          organizationId: this.organizationId,
          employeeId: employee.id,
          workDate: dateInstant(localDate),
          status: "PRESENT",
          checkInAt: now,
          isLate,
          source: "SELF_SERVICE",
          createdById: this.tenant.userId,
          updatedById: this.tenant.userId,
        });
    await this.audit(employee.id, "ATTENDANCE", record!.id, "CHECKED_IN", {
      timezone,
      organization: organization?.name,
    });
    return record;
  }

  async checkOut() {
    const employee = await this.linkedEmployee();
    const rows = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
      employeeId: employee.id,
    }).all();
    const active = rows.find((row) => row.checkInAt && !row.checkOutAt);
    if (!active?.checkInAt) throw new ConflictException("Check in before checking out");
    const now = Temporal.Now.instant();
    let workedMinutes: number;
    try {
      workedMinutes = minutesBetween(active.checkInAt, now);
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
    if (workedMinutes > 24 * 60)
      throw new ConflictException("Open attendance exceeds 24 hours; ask a manager to correct it");
    const [updated] = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
      id: active.id,
      version: active.version,
    }).updateAll({
      checkOutAt: now,
      workedMinutes,
      updatedById: this.tenant.userId,
      version: active.version + 1,
    });
    if (!updated) throw new ConflictException("Attendance changed. Reload and try again.");
    await this.audit(employee.id, "ATTENDANCE", active.id, "CHECKED_OUT", { workedMinutes });
    return updated;
  }

  async attendanceSummary(query: WorkforceQueryDto) {
    const from = query.from ?? Temporal.Now.plainDateISO().with({ day: 1 }).toString();
    const to = query.to ?? Temporal.Now.plainDateISO().toString();
    const records = await this.attendance({ ...query, from, to });
    const holidays = new Set((await this.holidays({ from, to })).map((row) => this.day(row.date)));
    const start = Temporal.PlainDate.from(from);
    const end = Temporal.PlainDate.from(to);
    let scheduledDays = 0;
    for (let date = start; Temporal.PlainDate.compare(date, end) <= 0; date = date.add({ days: 1 }))
      if (
        DEFAULT_WORKDAYS.includes(date.dayOfWeek as 1 | 2 | 3 | 4 | 5) &&
        !holidays.has(date.toString())
      )
        scheduledDays++;
    return attendanceMetrics(records, scheduledDays);
  }

  async schedules(employeeId?: string) {
    const rows = await this.db.orm.public.WorkSchedule.where({
      organizationId: this.organizationId,
    }).all();
    return employeeId ? rows.filter((row) => row.employeeId === employeeId) : rows;
  }
  async createSchedule(input: WorkScheduleDto) {
    await this.employee(input.employeeId);
    this.validTimezone(input.timezone);
    await this.assertSchedulePeriodMutable(input.effectiveFrom, input.effectiveTo);
    const workdays = JSON.parse(input.workdays) as number[];
    if (!workdays.length || new Set(workdays).size !== workdays.length)
      throw new BadRequestException("Choose unique workdays");
    const existing = await this.schedules(input.employeeId);
    if (
      existing.some(
        (row) =>
          this.day(row.effectiveFrom) <= (input.effectiveTo ?? "9999-12-31") &&
          (!row.effectiveTo || this.day(row.effectiveTo) >= input.effectiveFrom),
      )
    )
      throw new ConflictException("This schedule overlaps an existing effective period");
    const created = await this.db.orm.public.WorkSchedule.create({
      organizationId: this.organizationId,
      employeeId: input.employeeId,
      name: input.name.trim(),
      timezone: input.timezone,
      workdays: JSON.stringify(workdays),
      scheduledStartTime: input.scheduledStartTime,
      scheduledEndTime: input.scheduledEndTime,
      expectedDailyMinutes: input.expectedDailyMinutes,
      breakMinutes: input.breakMinutes,
      isActive: input.isActive,
      effectiveFrom: dateInstant(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? dateInstant(input.effectiveTo) : null,
    });
    await this.audit(input.employeeId, "WORK_SCHEDULE", created.id, "CREATED");
    return created;
  }

  async updateSchedule(id: string, input: WorkScheduleDto) {
    const schedule = await this.db.orm.public.WorkSchedule.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!schedule) throw new NotFoundException("Work schedule not found");
    if (!input.expectedVersion || input.expectedVersion !== schedule.version)
      throw new ConflictException("Work schedule changed. Reload and try again.");
    await this.employee(input.employeeId);
    this.validTimezone(input.timezone);
    const finalized = await this.db.orm.public.PayrollRun.where({
      organizationId: this.organizationId,
      status: "FINALIZED",
    }).all();
    const coveringRuns = finalized.filter(
      (run) =>
        this.day(run.periodStart) <=
          (schedule.effectiveTo ? this.day(schedule.effectiveTo) : "9999-12-31") &&
        this.day(run.periodEnd) >= this.day(schedule.effectiveFrom),
    );
    if (
      coveringRuns.length &&
      (input.employeeId !== schedule.employeeId ||
        input.timezone !== schedule.timezone ||
        input.workdays !== schedule.workdays ||
        input.scheduledStartTime !== schedule.scheduledStartTime ||
        input.scheduledEndTime !== schedule.scheduledEndTime ||
        input.expectedDailyMinutes !== schedule.expectedDailyMinutes ||
        input.breakMinutes !== schedule.breakMinutes ||
        input.effectiveFrom !== this.day(schedule.effectiveFrom))
    )
      throw new ConflictException(
        "Schedule details covered by finalized payroll cannot be changed; create a future schedule",
      );
    const latestFinalizedEnd = coveringRuns
      .map((run) => this.day(run.periodEnd))
      .sort()
      .at(-1);
    if (input.effectiveTo && latestFinalizedEnd && input.effectiveTo < latestFinalizedEnd)
      throw new ConflictException("Schedule end cannot precede finalized payroll");
    if (!input.isActive && !input.effectiveTo)
      throw new BadRequestException("Set an effective end date before deactivating a schedule");
    const workdays = JSON.parse(input.workdays) as number[];
    if (!workdays.length || new Set(workdays).size !== workdays.length)
      throw new BadRequestException("Choose unique workdays");
    const existing = await this.schedules(input.employeeId);
    if (
      existing.some(
        (row) =>
          row.id !== id &&
          this.day(row.effectiveFrom) <= (input.effectiveTo ?? "9999-12-31") &&
          (!row.effectiveTo || this.day(row.effectiveTo) >= input.effectiveFrom),
      )
    )
      throw new ConflictException("This schedule overlaps an existing effective period");
    const updated = await this.db.orm.public.WorkSchedule.where({
      organizationId: this.organizationId,
      id,
      version: input.expectedVersion,
    }).update({
      employeeId: input.employeeId,
      name: input.name.trim(),
      timezone: input.timezone,
      workdays: JSON.stringify(workdays),
      scheduledStartTime: input.scheduledStartTime,
      scheduledEndTime: input.scheduledEndTime,
      expectedDailyMinutes: input.expectedDailyMinutes,
      breakMinutes: input.breakMinutes,
      isActive: input.isActive,
      effectiveFrom: dateInstant(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? dateInstant(input.effectiveTo) : null,
      version: input.expectedVersion + 1,
    });
    await this.audit(input.employeeId, "WORK_SCHEDULE", id, "UPDATED", {
      isActive: input.isActive,
    });
    return updated;
  }

  async holidays(query: WorkforceQueryDto = {}) {
    let rows = await this.db.orm.public.Holiday.where({
      organizationId: this.organizationId,
    }).all();
    if (query.from && query.to) {
      const from = Temporal.PlainDate.from(query.from);
      const to = Temporal.PlainDate.from(query.to);
      const expanded = [];
      for (const row of rows) {
        if (!row.isRecurring) {
          if (this.day(row.date) >= query.from && this.day(row.date) <= query.to)
            expanded.push(row);
          continue;
        }
        const source = Temporal.PlainDate.from(this.day(row.date));
        for (let year = from.year; year <= to.year; year++) {
          try {
            const observed = Temporal.PlainDate.from({
              year,
              month: source.month,
              day: source.day,
            });
            if (
              Temporal.PlainDate.compare(observed, from) >= 0 &&
              Temporal.PlainDate.compare(observed, to) <= 0
            )
              expanded.push({ ...row, date: dateInstant(observed.toString()) });
          } catch {
            // February 29 holidays occur only in leap years.
          }
        }
      }
      rows = expanded;
    } else {
      if (query.from) rows = rows.filter((row) => this.day(row.date) >= query.from!);
      if (query.to) rows = rows.filter((row) => this.day(row.date) <= query.to!);
    }
    return rows.sort((a, b) => this.day(a.date).localeCompare(this.day(b.date)));
  }
  createHoliday(input: HolidayDto) {
    return this.db.orm.public.Holiday.create({
      organizationId: this.organizationId,
      name: input.name.trim(),
      date: dateInstant(input.date),
      isRecurring: input.isRecurring,
      durationMinutes: input.durationMinutes ?? null,
    });
  }
  async updateHoliday(id: string, input: HolidayDto) {
    const holiday = await this.db.orm.public.Holiday.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!holiday) throw new NotFoundException("Holiday not found");
    if (!input.expectedVersion || input.expectedVersion !== holiday.version)
      throw new ConflictException("Holiday changed. Reload and try again.");
    if (this.day(holiday.date) < Temporal.Now.plainDateISO().toString())
      throw new ConflictException("Historical holidays cannot be modified");
    const finalized = (
      await this.db.orm.public.PayrollRun.where({
        organizationId: this.organizationId,
        status: "FINALIZED",
      }).all()
    ).some(
      (run) =>
        this.day(run.periodStart) <= this.day(holiday.date) &&
        this.day(run.periodEnd) >= this.day(holiday.date),
    );
    if (finalized) throw new ConflictException("This holiday is covered by finalized payroll");
    const updated = await this.db.orm.public.Holiday.where({
      organizationId: this.organizationId,
      id,
      version: input.expectedVersion,
    }).update({
      name: input.name.trim(),
      date: dateInstant(input.date),
      isRecurring: input.isRecurring,
      durationMinutes: input.durationMinutes ?? null,
      version: input.expectedVersion + 1,
    });
    await this.audit(null, "HOLIDAY", id, "UPDATED");
    return updated;
  }
  async deleteHoliday(id: string) {
    const holiday = await this.db.orm.public.Holiday.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!holiday) throw new NotFoundException("Holiday not found");
    if (this.day(holiday.date) < Temporal.Now.plainDateISO().toString())
      throw new ConflictException("Historical holidays cannot be deleted");
    const finalized = (
      await this.db.orm.public.PayrollRun.where({
        organizationId: this.organizationId,
        status: "FINALIZED",
      }).all()
    ).some(
      (run) =>
        this.day(run.periodStart) <= this.day(holiday.date) &&
        this.day(run.periodEnd) >= this.day(holiday.date),
    );
    if (finalized) throw new ConflictException("This holiday is covered by finalized payroll");
    await this.db.orm.public.Holiday.where({ organizationId: this.organizationId, id }).delete();
    await this.audit(null, "HOLIDAY", id, "DELETED", { name: holiday.name });
    return { message: "Holiday deleted" };
  }

  async attendanceCorrections(query: WorkforceQueryDto) {
    let rows = await this.db.orm.public.AttendanceCorrectionRequest.where({
      organizationId: this.organizationId,
    }).all();
    if (query.employeeId) rows = rows.filter((row) => row.employeeId === query.employeeId);
    if (query.status) rows = rows.filter((row) => row.status === query.status);
    if (this.tenant.role === "PROJECT_MANAGER") {
      const manager = await this.linkedEmployee();
      const reports = await this.db.orm.public.Employee.where({
        organizationId: this.organizationId,
        managerId: manager.id,
      }).all();
      const allowed = new Set([manager.id, ...reports.map((row) => row.id)]);
      rows = rows.filter((row) => allowed.has(row.employeeId));
    }
    return rows.sort((a, b) => b.createdAt.toString().localeCompare(a.createdAt.toString()));
  }

  async requestAttendanceCorrection(input: AttendanceCorrectionDto) {
    const employee = await this.linkedEmployee();
    const record = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
      id: input.attendanceRecordId,
      employeeId: employee.id,
    }).first();
    if (!record) throw new NotFoundException("Attendance record not found");
    const pending = await this.db.orm.public.AttendanceCorrectionRequest.where({
      organizationId: this.organizationId,
      attendanceRecordId: record.id,
      status: "PENDING",
    }).first();
    if (pending) throw new ConflictException("A correction request is already pending");
    let checkIn: Temporal.Instant | null = null;
    let checkOut: Temporal.Instant | null = null;
    try {
      checkIn = input.proposedCheckInAt ? Temporal.Instant.from(input.proposedCheckInAt) : null;
      checkOut = input.proposedCheckOutAt ? Temporal.Instant.from(input.proposedCheckOutAt) : null;
    } catch {
      throw new BadRequestException("Check-in and check-out must include an explicit timezone");
    }
    if (checkIn && checkOut && Temporal.Instant.compare(checkIn, checkOut) >= 0)
      throw new BadRequestException("Check-out must be after check-in");
    const created = await this.db.orm.public.AttendanceCorrectionRequest.create({
      organizationId: this.organizationId,
      attendanceRecordId: record.id,
      employeeId: employee.id,
      requestedById: this.tenant.userId,
      proposedStatus: input.proposedStatus,
      proposedCheckInAt: checkIn,
      proposedCheckOutAt: checkOut,
      proposedWorkedMinutes: input.proposedWorkedMinutes ?? null,
      reason: input.reason.trim(),
      beforeSnapshot: JSON.stringify({
        status: record.status,
        checkInAt: record.checkInAt?.toString() ?? null,
        checkOutAt: record.checkOutAt?.toString() ?? null,
        workedMinutes: record.workedMinutes,
        version: record.version,
      }),
    });
    await this.audit(employee.id, "ATTENDANCE_CORRECTION", created.id, "REQUESTED");
    return created;
  }

  async reviewAttendanceCorrection(
    id: string,
    action: "approve" | "reject",
    input: ReviewAttendanceCorrectionDto,
  ) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM attendance_correction_requests WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const correction = await tx.orm.public.AttendanceCorrectionRequest.where({
        organizationId,
        id,
      }).first();
      if (!correction) throw new NotFoundException("Attendance correction not found");
      if (correction.status !== "PENDING" || correction.version !== input.expectedVersion)
        throw new ConflictException("Correction changed. Reload and try again.");
      await this.assertReviewScope(correction.employeeId);
      const own = await this.linkedEmployee().catch(() => null);
      if (own?.id === correction.employeeId)
        throw new ForbiddenException("You cannot review your own correction request");
      const record = await tx.orm.public.AttendanceRecord.where({
        organizationId,
        id: correction.attendanceRecordId,
      }).first();
      if (!record) throw new NotFoundException("Attendance record not found");
      const entries = await tx.orm.public.PayrollEntry.where({
        organizationId,
        employeeId: correction.employeeId,
      }).all();
      const finalizedRuns = await tx.orm.public.PayrollRun.where({
        organizationId,
        status: "FINALIZED",
      }).all();
      const finalized = finalizedRuns.some(
        (run) =>
          entries.some((entry) => entry.payrollRunId === run.id) &&
          this.day(run.periodStart) <= this.day(record.workDate) &&
          this.day(run.periodEnd) >= this.day(record.workDate),
      );
      if (action === "approve" && !finalized)
        await tx.orm.public.AttendanceRecord.where({ organizationId, id: record.id }).update({
          status: correction.proposedStatus,
          checkInAt: correction.proposedCheckInAt,
          checkOutAt: correction.proposedCheckOutAt,
          workedMinutes: correction.proposedWorkedMinutes,
          updatedById: this.tenant.userId,
          version: record.version + 1,
        });
      const updated = await tx.orm.public.AttendanceCorrectionRequest.where({
        organizationId,
        id,
      }).update({
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewedById: this.tenant.userId,
        reviewedAt: Temporal.Now.instant(),
        reviewReason: input.reason?.trim() || null,
        payrollImpact: action === "approve" && finalized,
        version: input.expectedVersion + 1,
      });
      await this.audit(
        correction.employeeId,
        "ATTENDANCE_CORRECTION",
        id,
        action.toUpperCase(),
        { payrollImpact: finalized },
        tx,
      );
      return updated;
    });
  }

  async calendar(query: WorkforceCalendarQueryDto) {
    const from = Temporal.PlainDate.from(query.from);
    const to = Temporal.PlainDate.from(query.to);
    if (
      Temporal.PlainDate.compare(from, to) > 0 ||
      from.until(to, { largestUnit: "days" }).days > 62
    )
      throw new BadRequestException("Calendar ranges must be between 1 and 63 days");
    let employees = await this.db.orm.public.Employee.where({
      organizationId: this.organizationId,
    }).all();
    if (this.tenant.role === "PROJECT_MANAGER") {
      const manager = await this.linkedEmployee();
      employees = employees.filter(
        (employee) => employee.id === manager.id || employee.managerId === manager.id,
      );
    }
    if (query.employeeId) employees = employees.filter((row) => row.id === query.employeeId);
    if (query.departmentId)
      employees = employees.filter((row) => row.departmentId === query.departmentId);
    const employeeIds = new Set(employees.map((row) => row.id));
    const [attendance, leave, overtime, schedules, holidays] = await Promise.all([
      this.attendance({ from: query.from, to: query.to }),
      this.leaveRequests({}),
      this.overtime({}),
      this.schedules(),
      this.holidays({ from: query.from, to: query.to }),
    ]);
    return {
      employees: employees.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`,
        departmentId: row.departmentId,
      })),
      attendance: attendance.filter((row) => employeeIds.has(row.employeeId)),
      leave: leave.filter(
        (row) =>
          employeeIds.has(row.employeeId) &&
          ["PENDING_APPROVAL", "APPROVED"].includes(row.status) &&
          this.day(row.startDate) <= query.to &&
          this.day(row.endDate) >= query.from,
      ),
      overtime: overtime.filter(
        (row) =>
          employeeIds.has(row.employeeId) &&
          row.status === "APPROVED" &&
          this.day(row.workDate) >= query.from &&
          this.day(row.workDate) <= query.to,
      ),
      schedules: schedules.filter((row) => employeeIds.has(row.employeeId)),
      holidays,
      timezone: (await this.settings()).timezone,
    };
  }

  leaveTypes() {
    return this.db.orm.public.LeaveType.where({ organizationId: this.organizationId }).all();
  }

  leavePolicies() {
    return this.db.orm.public.LeaveAccrualPolicy.where({
      organizationId: this.organizationId,
    }).all();
  }

  async createLeavePolicy(input: LeaveAccrualPolicyDto) {
    const type = await this.db.orm.public.LeaveType.where({
      organizationId: this.organizationId,
      id: input.leaveTypeId,
    }).first();
    if (!type) throw new NotFoundException("Leave type not found");
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom)
      throw new BadRequestException("Effective end must follow the start date");
    if (input.carryForwardMode === "CAPPED" && input.carryForwardCapMinutes === undefined)
      throw new BadRequestException("A carry-forward cap is required");
    const created = await this.db.orm.public.LeaveAccrualPolicy.create({
      organizationId: this.organizationId,
      leaveTypeId: input.leaveTypeId,
      name: input.name.trim(),
      frequency: input.frequency,
      entitlementMinutes: input.entitlementMinutes,
      effectiveFrom: dateInstant(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? dateInstant(input.effectiveTo) : null,
      prorateNewJoiners: input.prorateNewJoiners,
      maximumBalanceMinutes: input.maximumBalanceMinutes ?? null,
      carryForwardMode: input.carryForwardMode,
      carryForwardCapMinutes: input.carryForwardCapMinutes ?? null,
      expiresAfterMonths: input.expiresAfterMonths ?? null,
      isActive: input.isActive,
    });
    await this.audit(null, "LEAVE_POLICY", created.id, "CREATED");
    return created;
  }

  async updateLeavePolicy(id: string, input: LeaveAccrualPolicyDto) {
    const current = await this.db.orm.public.LeaveAccrualPolicy.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!current) throw new NotFoundException("Leave policy not found");
    if (!input.expectedVersion || input.expectedVersion !== current.version)
      throw new ConflictException("Leave policy changed. Reload and try again.");
    const updated = await this.db.orm.public.LeaveAccrualPolicy.where({
      organizationId: this.organizationId,
      id,
      version: input.expectedVersion,
    }).update({
      name: input.name.trim(),
      effectiveTo: input.effectiveTo ? dateInstant(input.effectiveTo) : null,
      maximumBalanceMinutes: input.maximumBalanceMinutes ?? null,
      carryForwardMode: input.carryForwardMode,
      carryForwardCapMinutes: input.carryForwardCapMinutes ?? null,
      expiresAfterMonths: input.expiresAfterMonths ?? null,
      isActive: input.isActive,
      version: input.expectedVersion + 1,
    });
    await this.audit(null, "LEAVE_POLICY", id, "UPDATED", { version: updated?.version });
    return updated;
  }

  async adjustLeaveBalance(input: LeaveBalanceAdjustmentDto) {
    await this.employee(input.employeeId);
    const type = await this.db.orm.public.LeaveType.where({
      organizationId: this.organizationId,
      id: input.leaveTypeId,
    }).first();
    if (!type) throw new NotFoundException("Leave type not found");
    try {
      const entry = await this.db.orm.public.LeaveLedgerEntry.create({
        organizationId: this.organizationId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        kind: "ADJUSTMENT",
        units: 0,
        minutes: input.minutes,
        effectiveDate: dateInstant(input.effectiveDate),
        idempotencyKey: `adjustment:${input.idempotencyKey}`,
        notes: input.reason.trim(),
      });
      await this.audit(input.employeeId, "LEAVE_BALANCE", entry.id, "ADJUSTED", {
        minutes: input.minutes,
        effectiveDate: input.effectiveDate,
      });
      return entry;
    } catch (error) {
      if (String(error).toLowerCase().includes("unique"))
        throw new ConflictException("This balance adjustment was already applied");
      throw error;
    }
  }

  async runLeaveAccruals(input: LeaveAccrualRunDto) {
    const organizationId = this.organizationId;
    const policies = (await this.leavePolicies()).filter(
      (row) => row.isActive && (!input.policyId || row.id === input.policyId),
    );
    let employees = await this.db.orm.public.Employee.where({ organizationId }).all();
    employees = employees.filter(
      (row) =>
        ["ACTIVE", "ON_LEAVE"].includes(row.status) &&
        (!input.employeeId || row.id === input.employeeId) &&
        this.day(row.hireDate) <= input.asOfDate &&
        (!row.terminationDate || this.day(row.terminationDate) >= input.asOfDate),
    );
    const [existing, approvedRequests] = await Promise.all([
      this.db.orm.public.LeaveLedgerEntry.where({ organizationId }).all(),
      this.db.orm.public.LeaveRequest.where({ organizationId, status: "APPROVED" }).all(),
    ]);
    const proposed: Array<{
      employeeId: string;
      policyId: string;
      leaveTypeId: string;
      effectiveDate: string;
      minutes: number;
      idempotencyKey: string;
      kind: "ACCRUAL" | "CARRY_FORWARD" | "EXPIRATION";
    }> = [];
    for (const row of existing.filter(
      (entry) =>
        entry.kind === "CARRY_FORWARD" &&
        entry.expiresAt &&
        this.day(entry.expiresAt) <= input.asOfDate,
    )) {
      const idempotencyKey = `carry-expiration:${row.id}`;
      if (existing.some((entry) => entry.idempotencyKey === idempotencyKey)) continue;
      const balance = existing
        .filter(
          (entry) => entry.employeeId === row.employeeId && entry.leaveTypeId === row.leaveTypeId,
        )
        .reduce((sum, entry) => {
          const minutes = entry.minutes ?? entry.units * 240;
          return ["DEDUCTION", "EXPIRATION"].includes(entry.kind) ? sum - minutes : sum + minutes;
        }, 0);
      const reserved = approvedRequests
        .filter(
          (request) =>
            request.employeeId === row.employeeId &&
            request.leaveTypeId === row.leaveTypeId &&
            this.day(request.startDate) >= this.day(row.expiresAt!),
        )
        .reduce(
          (sum, request) => sum + (request.requestedMinutes ?? request.requestedUnits * 240),
          0,
        );
      const minutes = expirableCarryForward(balance, row.minutes ?? row.units * 240, reserved);
      if (!minutes) continue;
      proposed.push({
        employeeId: row.employeeId,
        policyId: row.policyId!,
        leaveTypeId: row.leaveTypeId,
        effectiveDate: this.day(row.expiresAt!),
        minutes,
        idempotencyKey,
        kind: "EXPIRATION",
      });
    }
    for (const employee of employees)
      for (const policy of policies) {
        const policyEntries = existing.filter(
          (row) => row.employeeId === employee.id && row.leaveTypeId === policy.leaveTypeId,
        );
        const signed = (rows: typeof policyEntries) =>
          rows.reduce((sum, row) => {
            const minutes = row.minutes ?? row.units * 240;
            if (["DEDUCTION", "EXPIRATION"].includes(row.kind)) return sum - minutes;
            return sum + minutes;
          }, 0);
        let balance =
          signed(policyEntries) -
          proposed
            .filter(
              (row) =>
                row.kind === "EXPIRATION" &&
                row.employeeId === employee.id &&
                row.leaveTypeId === policy.leaveTypeId,
            )
            .reduce((sum, row) => sum + row.minutes, 0);
        const finalYear = Temporal.PlainDate.from(input.asOfDate).year;
        const firstRolloverYear = Math.max(
          Temporal.PlainDate.from(this.day(policy.effectiveFrom)).year + 1,
          Temporal.PlainDate.from(this.day(employee.hireDate)).year + 1,
        );
        for (let year = firstRolloverYear; year <= finalYear; year++) {
          const boundary = `${year}-01-01`;
          const expirationKey = `expiration:${policy.id}:${employee.id}:${year}`;
          const carryKey = `carry:${policy.id}:${employee.id}:${year}`;
          if (
            existing.some(
              (row) => row.idempotencyKey === expirationKey || row.idempotencyKey === carryKey,
            )
          )
            continue;
          const priorBalance = signed(
            policyEntries.filter((row) => this.day(row.effectiveDate) < boundary),
          );
          if (priorBalance <= 0) continue;
          const reserved = approvedRequests
            .filter(
              (row) =>
                row.employeeId === employee.id &&
                row.leaveTypeId === policy.leaveTypeId &&
                this.day(row.startDate) >= boundary,
            )
            .reduce((sum, row) => sum + (row.requestedMinutes ?? row.requestedUnits * 240), 0);
          const configured = carryForwardMinutes(
            priorBalance,
            policy.carryForwardMode,
            policy.carryForwardCapMinutes,
          );
          const carried = Math.min(priorBalance, Math.max(configured, reserved));
          proposed.push({
            employeeId: employee.id,
            policyId: policy.id,
            leaveTypeId: policy.leaveTypeId,
            effectiveDate: boundary,
            minutes: priorBalance,
            idempotencyKey: expirationKey,
            kind: "EXPIRATION",
          });
          if (carried)
            proposed.push({
              employeeId: employee.id,
              policyId: policy.id,
              leaveTypeId: policy.leaveTypeId,
              effectiveDate: boundary,
              minutes: carried,
              idempotencyKey: carryKey,
              kind: "CARRY_FORWARD",
            });
          balance += carried - priorBalance;
        }
        for (const period of accrualPeriods(
          {
            frequency: policy.frequency,
            entitlementMinutes: policy.entitlementMinutes,
            effectiveFrom: this.day(policy.effectiveFrom),
            effectiveTo: policy.effectiveTo ? this.day(policy.effectiveTo) : null,
            prorateNewJoiners: policy.prorateNewJoiners,
          },
          this.day(employee.hireDate),
          input.asOfDate,
        )) {
          const idempotencyKey = `accrual:${policy.id}:${employee.id}:${period.key}`;
          if (existing.some((row) => row.idempotencyKey === idempotencyKey)) continue;
          const minutes = cappedAccrual(balance, period.minutes, policy.maximumBalanceMinutes);
          if (!minutes) continue;
          proposed.push({
            employeeId: employee.id,
            policyId: policy.id,
            leaveTypeId: policy.leaveTypeId,
            effectiveDate: period.date,
            minutes,
            idempotencyKey,
            kind: "ACCRUAL",
          });
          balance += minutes;
        }
      }
    if (input.preview) return { preview: true, entries: proposed };
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ":leave-accrual"}))`
          .affectedCount()
          .build(),
      );
      let created = 0;
      for (const item of proposed)
        try {
          await tx.orm.public.LeaveLedgerEntry.create({
            organizationId,
            employeeId: item.employeeId,
            leaveTypeId: item.leaveTypeId,
            policyId: item.policyId,
            kind: item.kind,
            units: 0,
            minutes: item.minutes,
            effectiveDate: dateInstant(item.effectiveDate),
            idempotencyKey: item.idempotencyKey,
            expiresAt:
              item.kind === "CARRY_FORWARD" &&
              policies.find((policy) => policy.id === item.policyId)?.expiresAfterMonths
                ? dateInstant(
                    Temporal.PlainDate.from(item.effectiveDate)
                      .add({
                        months: policies.find((policy) => policy.id === item.policyId)!
                          .expiresAfterMonths!,
                      })
                      .toString(),
                  )
                : null,
            notes:
              item.kind === "ACCRUAL"
                ? "Policy accrual"
                : item.kind === "CARRY_FORWARD"
                  ? "Policy carry-forward"
                  : "Prior entitlement period expiration",
          });
          created++;
        } catch (error) {
          if (!String(error).toLowerCase().includes("unique")) throw error;
        }
      await this.audit(
        null,
        "LEAVE_ACCRUAL",
        organizationId,
        "PROCESSED",
        {
          asOfDate: input.asOfDate,
          created,
        },
        tx,
      );
      return { preview: false, created, entries: proposed };
    });
  }
  createLeaveType(input: LeaveTypeDto) {
    return this.db.orm.public.LeaveType.create({
      organizationId: this.organizationId,
      name: input.name.trim(),
      code: input.code,
      description: input.description?.trim() || null,
      isPaid: input.isPaid,
      requiresApproval: input.requiresApproval,
      annualAllowanceUnits: input.annualAllowanceUnits,
    });
  }
  async leaveRequests(query: WorkforceQueryDto, selfOnly = false) {
    const self = selfOnly ? await this.linkedEmployee() : null;
    let rows = await this.db.orm.public.LeaveRequest.where({
      organizationId: this.organizationId,
    }).all();
    const employeeId = self?.id ?? query.employeeId;
    if (employeeId) rows = rows.filter((row) => row.employeeId === employeeId);
    if (!selfOnly && this.tenant.role === "PROJECT_MANAGER") {
      const manager = await this.linkedEmployee();
      const reports = await this.db.orm.public.Employee.where({
        organizationId: this.organizationId,
        managerId: manager.id,
      }).all();
      const allowed = new Set([manager.id, ...reports.map((employee) => employee.id)]);
      rows = rows.filter((row) => allowed.has(row.employeeId));
    }
    if (query.status) rows = rows.filter((row) => row.status === query.status);
    return rows.sort((a, b) => this.day(b.startDate).localeCompare(this.day(a.startDate)));
  }
  async createLeave(input: LeaveRequestDto, selfService = false) {
    await this.assertEmployeeAccess(input.employeeId, selfService);
    const type = await this.db.orm.public.LeaveType.where({
      organizationId: this.organizationId,
      id: input.leaveTypeId,
      isActive: true,
    }).first();
    if (!type) throw new BadRequestException("Active leave type not found");
    const schedule = await this.scheduleFor(input.employeeId, input.startDate);
    const workdays = schedule ? (JSON.parse(schedule.workdays) as number[]) : [...DEFAULT_WORKDAYS];
    const holidays = new Set(
      (await this.holidays({ from: input.startDate, to: input.endDate })).map((row) =>
        this.day(row.date),
      ),
    );
    let requestedUnits: number;
    try {
      requestedUnits = workingLeaveUnits(
        input.startDate,
        input.endDate,
        workdays,
        holidays,
        input.dayPortion === "HALF_DAY",
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (!requestedUnits)
      throw new BadRequestException("The selected range has no scheduled workdays");
    const requests = await this.leaveRequests({ employeeId: input.employeeId });
    if (
      requests.some(
        (row) =>
          !["REJECTED", "CANCELLED"].includes(row.status) &&
          this.day(row.startDate) <= input.endDate &&
          this.day(row.endDate) >= input.startDate,
      )
    )
      throw new ConflictException("Leave dates overlap an existing request");
    const created = await this.db.orm.public.LeaveRequest.create({
      organizationId: this.organizationId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: dateInstant(input.startDate),
      endDate: dateInstant(input.endDate),
      dayPortion: input.dayPortion,
      requestedUnits,
      requestedMinutes: Math.round(requestedUnits * ((schedule?.expectedDailyMinutes ?? 480) / 2)),
      reason: input.reason?.trim() || null,
    });
    await this.audit(input.employeeId, "LEAVE", created.id, "CREATED", { requestedUnits });
    return created;
  }
  async leaveBalances(employeeId?: string) {
    const employees = employeeId
      ? [await this.employee(employeeId)]
      : await this.db.orm.public.Employee.where({ organizationId: this.organizationId }).all();
    const types = await this.leaveTypes();
    const ledger = await this.db.orm.public.LeaveLedgerEntry.where({
      organizationId: this.organizationId,
    }).all();
    const requests = await this.db.orm.public.LeaveRequest.where({
      organizationId: this.organizationId,
    }).all();
    return await Promise.all(
      employees.flatMap((employee) =>
        types.map(async (type) => {
          const schedule = await this.scheduleFor(
            employee.id,
            Temporal.Now.plainDateISO().toString(),
          );
          const halfDayMinutes = Math.round((schedule?.expectedDailyMinutes ?? 480) / 2);
          const entries = ledger.filter(
            (row) => row.employeeId === employee.id && row.leaveTypeId === type.id,
          );
          const signedMinutes = entries.reduce((sum, row) => {
            const minutes = row.minutes ?? row.units * halfDayMinutes;
            return ["DEDUCTION", "EXPIRATION"].includes(row.kind) ? sum - minutes : sum + minutes;
          }, 0);
          const usedMinutes = entries
            .filter((row) => row.kind === "DEDUCTION")
            .reduce((sum, row) => sum + (row.minutes ?? row.units * halfDayMinutes), 0);
          const accruedMinutes = entries
            .filter((row) => ["ALLOCATION", "ACCRUAL"].includes(row.kind))
            .reduce((sum, row) => sum + (row.minutes ?? row.units * halfDayMinutes), 0);
          const carriedForwardMinutes = entries
            .filter((row) => row.kind === "CARRY_FORWARD")
            .reduce((sum, row) => sum + (row.minutes ?? row.units * halfDayMinutes), 0);
          const expiredMinutes = entries
            .filter((row) => row.kind === "EXPIRATION")
            .reduce((sum, row) => sum + (row.minutes ?? row.units * halfDayMinutes), 0);
          const pendingMinutes = requests
            .filter(
              (row) =>
                row.employeeId === employee.id &&
                row.leaveTypeId === type.id &&
                row.status === "PENDING_APPROVAL",
            )
            .reduce(
              (sum, row) => sum + (row.requestedMinutes ?? row.requestedUnits * halfDayMinutes),
              0,
            );
          const legacyAllowanceMinutes = type.annualAllowanceUnits * halfDayMinutes;
          return {
            employeeId: employee.id,
            leaveTypeId: type.id,
            leaveTypeName: type.name,
            allowanceUnits: type.annualAllowanceUnits,
            availableMinutes: legacyAllowanceMinutes + signedMinutes,
            accruedMinutes,
            usedMinutes,
            pendingMinutes,
            carriedForwardMinutes,
            expiredMinutes,
          };
        }),
      ),
    );
  }
  async transitionLeave(
    id: string,
    action: "submit" | "approve" | "reject" | "cancel",
    input: ReviewLeaveDto,
    selfService = false,
  ) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM leave_requests WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const request = await tx.orm.public.LeaveRequest.where({ organizationId, id }).first();
      if (!request) throw new NotFoundException("Leave request not found");
      if (selfService) await this.assertEmployeeAccess(request.employeeId, true);
      else await this.assertReviewScope(request.employeeId);
      const expected: Record<typeof action, string[]> = {
        submit: ["DRAFT"],
        approve: ["PENDING_APPROVAL"],
        reject: ["PENDING_APPROVAL"],
        cancel: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
      };
      if (request.version !== input.expectedVersion || !expected[action].includes(request.status))
        throw new ConflictException("Leave request changed or cannot make this transition");
      if (
        ["approve", "reject"].includes(action) &&
        request.employeeId === (await this.linkedEmployee().catch(() => null))?.id
      )
        throw new ForbiddenException("You cannot review your own leave request");
      if (action === "approve") {
        const type = await tx.orm.public.LeaveType.where({
          organizationId,
          id: request.leaveTypeId,
          isActive: true,
        }).first();
        if (!type) throw new ConflictException("Leave type is inactive");
        const balances = await this.leaveBalances(request.employeeId);
        const balance = balances.find((row) => row.leaveTypeId === request.leaveTypeId)!;
        const schedule = await this.scheduleFor(request.employeeId, this.day(request.startDate));
        const requestedMinutes =
          request.requestedMinutes ??
          Math.round(request.requestedUnits * ((schedule?.expectedDailyMinutes ?? 480) / 2));
        if (balance.availableMinutes < requestedMinutes)
          throw new ConflictException("Insufficient leave balance");
        await tx.orm.public.LeaveLedgerEntry.create({
          organizationId,
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          leaveRequestId: id,
          kind: "DEDUCTION",
          units: request.requestedUnits,
          minutes: requestedMinutes,
          notes: "Approved leave",
        });
      }
      if (action === "cancel" && request.status === "APPROVED")
        await tx.orm.public.LeaveLedgerEntry.create({
          organizationId,
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          leaveRequestId: id,
          kind: "RESTORATION",
          units: request.requestedUnits,
          minutes:
            request.requestedMinutes ??
            Math.round(
              request.requestedUnits *
                (((await this.scheduleFor(request.employeeId, this.day(request.startDate)))
                  ?.expectedDailyMinutes ?? 480) /
                  2),
            ),
          notes: "Cancelled leave",
        });
      const status =
        action === "submit"
          ? "PENDING_APPROVAL"
          : action === "approve"
            ? "APPROVED"
            : action === "reject"
              ? "REJECTED"
              : "CANCELLED";
      const [updated] = await tx.orm.public.LeaveRequest.where({
        organizationId,
        id,
        version: input.expectedVersion,
      }).updateAll({
        status,
        version: input.expectedVersion + 1,
        ...(action === "submit" ? { submittedAt: Temporal.Now.instant() } : {}),
        ...(["approve", "reject"].includes(action)
          ? {
              reviewedById: this.tenant.userId,
              reviewedAt: Temporal.Now.instant(),
              rejectionReason: action === "reject" ? input.reason?.trim() || null : null,
            }
          : {}),
      });
      if (!updated) throw new ConflictException("Leave request changed. Reload and try again.");
      await this.audit(request.employeeId, "LEAVE", id, action.toUpperCase(), undefined, tx);
      return updated;
    });
  }

  async overtime(query: WorkforceQueryDto, selfOnly = false) {
    const self = selfOnly ? await this.linkedEmployee() : null;
    let rows = await this.db.orm.public.OvertimeRequest.where({
      organizationId: this.organizationId,
    }).all();
    const employeeId = self?.id ?? query.employeeId;
    if (employeeId) rows = rows.filter((row) => row.employeeId === employeeId);
    if (!selfOnly && this.tenant.role === "PROJECT_MANAGER") {
      const manager = await this.linkedEmployee();
      const reports = await this.db.orm.public.Employee.where({
        organizationId: this.organizationId,
        managerId: manager.id,
      }).all();
      const allowed = new Set([manager.id, ...reports.map((employee) => employee.id)]);
      rows = rows.filter((row) => allowed.has(row.employeeId));
    }
    if (query.status) rows = rows.filter((row) => row.status === query.status);
    return rows.sort((a, b) => this.day(b.workDate).localeCompare(this.day(a.workDate)));
  }
  async createOvertime(input: OvertimeRequestDto, selfService = false) {
    await this.assertEmployeeAccess(input.employeeId, selfService);
    const duplicate = (await this.overtime({ employeeId: input.employeeId })).find(
      (row) =>
        this.day(row.workDate) === input.workDate &&
        !["REJECTED", "CANCELLED"].includes(row.status),
    );
    if (duplicate)
      throw new ConflictException("An overtime request already exists for this workday");
    const created = await this.db.orm.public.OvertimeRequest.create({
      organizationId: this.organizationId,
      employeeId: input.employeeId,
      workDate: dateInstant(input.workDate),
      requestedMinutes: input.requestedMinutes,
      reason: input.reason.trim(),
      hourlyRate: this.rate(input.hourlyRate),
      multiplier: this.multiplier(input.multiplier),
    });
    await this.audit(input.employeeId, "OVERTIME", created.id, "CREATED", {
      requestedMinutes: input.requestedMinutes,
    });
    return created;
  }
  async transitionOvertime(
    id: string,
    action: "submit" | "approve" | "reject" | "cancel",
    input: ReviewOvertimeDto,
    selfService = false,
  ) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM overtime_requests WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const request = await tx.orm.public.OvertimeRequest.where({ organizationId, id }).first();
      if (!request) throw new NotFoundException("Overtime request not found");
      if (selfService) await this.assertEmployeeAccess(request.employeeId, true);
      else await this.assertReviewScope(request.employeeId);
      const expected: Record<typeof action, string[]> = {
        submit: ["DRAFT"],
        approve: ["PENDING_APPROVAL"],
        reject: ["PENDING_APPROVAL"],
        cancel: ["DRAFT", "PENDING_APPROVAL"],
      };
      if (request.version !== input.expectedVersion || !expected[action].includes(request.status))
        throw new ConflictException("Overtime request changed or cannot make this transition");
      if (
        ["approve", "reject"].includes(action) &&
        request.employeeId === (await this.linkedEmployee().catch(() => null))?.id
      )
        throw new ForbiddenException("You cannot review your own overtime request");
      const approvedMinutes =
        action === "approve" ? (input.approvedMinutes ?? request.requestedMinutes) : null;
      if (approvedMinutes && approvedMinutes > request.requestedMinutes)
        throw new BadRequestException("Approved minutes cannot exceed requested minutes");
      const status =
        action === "submit"
          ? "PENDING_APPROVAL"
          : action === "approve"
            ? "APPROVED"
            : action === "reject"
              ? "REJECTED"
              : "CANCELLED";
      const [updated] = await tx.orm.public.OvertimeRequest.where({
        organizationId,
        id,
        version: input.expectedVersion,
      }).updateAll({
        status,
        version: input.expectedVersion + 1,
        approvedMinutes,
        approvedRateSnapshot: action === "approve" ? request.hourlyRate : null,
        ...(["approve", "reject"].includes(action)
          ? {
              reviewedById: this.tenant.userId,
              reviewedAt: Temporal.Now.instant(),
              rejectionReason: action === "reject" ? input.reason?.trim() || null : null,
            }
          : {}),
      });
      if (!updated) throw new ConflictException("Overtime request changed. Reload and try again.");
      await this.audit(
        request.employeeId,
        "OVERTIME",
        id,
        action.toUpperCase(),
        { approvedMinutes },
        tx,
      );
      return updated;
    });
  }
}
