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
  HolidayDto,
  LeaveRequestDto,
  LeaveTypeDto,
  OvertimeRequestDto,
  ReviewLeaveDto,
  ReviewOvertimeDto,
  WorkforceQueryDto,
  WorkScheduleDto,
} from "./workforce.dto.js";
import {
  attendanceMetrics,
  dateInstant,
  DEFAULT_WORKDAYS,
  minutesBetween,
  workingLeaveUnits,
} from "./workforce-rules.js";

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
    employeeId: string,
    entityType: string,
    entityId: string,
    action: string,
    details?: unknown,
    tx: OrmDatabase = this.db,
  ) {
    return tx.orm.public.WorkforceAuditEvent.create({
      organizationId: this.organizationId,
      employeeId,
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

  async attendance(query: WorkforceQueryDto, selfOnly = false) {
    const self = selfOnly ? await this.linkedEmployee() : null;
    let rows = await this.db.orm.public.AttendanceRecord.where({
      organizationId: this.organizationId,
    }).all();
    const employeeId = self?.id ?? query.employeeId;
    if (employeeId) rows = rows.filter((row) => row.employeeId === employeeId);
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
    const timezone = schedule?.timezone ?? "UTC";
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
    return this.db.orm.public.WorkSchedule.create({
      organizationId: this.organizationId,
      employeeId: input.employeeId,
      timezone: input.timezone,
      workdays: JSON.stringify(workdays),
      scheduledStartTime: input.scheduledStartTime,
      scheduledEndTime: input.scheduledEndTime,
      expectedDailyMinutes: input.expectedDailyMinutes,
      effectiveFrom: dateInstant(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? dateInstant(input.effectiveTo) : null,
    });
  }

  async holidays(query: WorkforceQueryDto = {}) {
    let rows = await this.db.orm.public.Holiday.where({
      organizationId: this.organizationId,
    }).all();
    if (query.from) rows = rows.filter((row) => this.day(row.date) >= query.from!);
    if (query.to) rows = rows.filter((row) => this.day(row.date) <= query.to!);
    return rows.sort((a, b) => this.day(a.date).localeCompare(this.day(b.date)));
  }
  createHoliday(input: HolidayDto) {
    return this.db.orm.public.Holiday.create({
      organizationId: this.organizationId,
      name: input.name.trim(),
      date: dateInstant(input.date),
      isRecurring: input.isRecurring,
    });
  }
  async deleteHoliday(id: string) {
    const holiday = await this.db.orm.public.Holiday.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!holiday) throw new NotFoundException("Holiday not found");
    if (this.day(holiday.date) < Temporal.Now.plainDateISO().toString())
      throw new ConflictException("Historical holidays cannot be deleted");
    await this.db.orm.public.Holiday.where({ organizationId: this.organizationId, id }).delete();
    return { message: "Holiday deleted" };
  }

  leaveTypes() {
    return this.db.orm.public.LeaveType.where({ organizationId: this.organizationId }).all();
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
    return employees.flatMap((employee) =>
      types.map((type) => {
        const entries = ledger.filter(
          (row) => row.employeeId === employee.id && row.leaveTypeId === type.id,
        );
        const usedUnits = entries.reduce(
          (sum, row) =>
            sum +
            (row.kind === "DEDUCTION" ? row.units : row.kind === "RESTORATION" ? -row.units : 0),
          0,
        );
        const pendingUnits = requests
          .filter(
            (row) =>
              row.employeeId === employee.id &&
              row.leaveTypeId === type.id &&
              row.status === "PENDING_APPROVAL",
          )
          .reduce((sum, row) => sum + row.requestedUnits, 0);
        return {
          employeeId: employee.id,
          leaveTypeId: type.id,
          leaveTypeName: type.name,
          allowanceUnits: type.annualAllowanceUnits,
          usedUnits,
          pendingUnits,
          remainingUnits: type.annualAllowanceUnits - usedUnits,
        };
      }),
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
        if (balance.remainingUnits < request.requestedUnits)
          throw new ConflictException("Insufficient leave balance");
        await tx.orm.public.LeaveLedgerEntry.create({
          organizationId,
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          leaveRequestId: id,
          kind: "DEDUCTION",
          units: request.requestedUnits,
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
