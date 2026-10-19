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
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type {
  CreatePayrollRunDto,
  PayrollAdjustmentDto,
  PayrollRunQueryDto,
  RecordPayrollPaymentDto,
} from "./payroll.dto.js";
import {
  calculateFixedPayroll,
  centsToMoney,
  moneyToCents,
  payrollAmount,
  validatePayPeriod,
} from "./payroll-calculations.js";
import { PayrollPayslipQueue } from "./payroll-payslip.queue.js";
import { PayrollPayslipStorageService } from "./payroll-payslip-storage.service.js";

type RunStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "FINALIZED";
type OrmDatabase = Pick<Database, "orm">;
type EmployeeRow = Awaited<
  ReturnType<ReturnType<Database["orm"]["public"]["Employee"]["where"]>["all"]>
>[number];
type SalaryRow = Awaited<
  ReturnType<ReturnType<Database["orm"]["public"]["SalaryStructure"]["where"]>["all"]>
>[number];
type SalaryComponentRow = Awaited<
  ReturnType<ReturnType<Database["orm"]["public"]["SalaryComponent"]["where"]>["all"]>
>[number];

@Injectable({ scope: Scope.REQUEST })
export class PayrollService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    private readonly payslips: PayrollPayslipQueue,
    private readonly payslipStorage: PayrollPayslipStorageService,
  ) {}
  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }
  private get organizationId() {
    return this.tenant.organizationId;
  }
  private get userId() {
    return this.tenant.userId;
  }
  private instant(value: string) {
    try {
      return Temporal.Instant.from(`${value}T00:00:00Z`);
    } catch {
      throw new BadRequestException("Provide a valid date");
    }
  }
  private day(value: { toString(): string }) {
    return value.toString().slice(0, 10);
  }
  private async run(id: string) {
    const run = await this.db.orm.public.PayrollRun.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!run) throw new NotFoundException("Payroll run not found");
    return run;
  }
  async list(query: PayrollRunQueryDto) {
    let runs = await this.db.orm.public.PayrollRun.where({
      organizationId: this.organizationId,
    }).all();
    if (query.status) runs = runs.filter((run) => run.status === query.status);
    runs.sort((a, b) => b.createdAt.toString().localeCompare(a.createdAt.toString()));
    return { items: runs.slice(query.offset, query.offset + query.limit), total: runs.length };
  }
  async get(id: string) {
    const run = await this.run(id);
    const entries = await this.db.orm.public.PayrollEntry.where({
      organizationId: this.organizationId,
      payrollRunId: id,
    }).all();
    const detailed = await Promise.all(
      entries.map(async (entry) => {
        const [components, payments] = await Promise.all([
          this.db.orm.public.PayrollEntryComponent.where({
            organizationId: this.organizationId,
            payrollEntryId: entry.id,
          })
            .orderBy((row) => row.sortOrder.asc())
            .all(),
          this.db.orm.public.PayrollPayment.where({
            organizationId: this.organizationId,
            payrollEntryId: entry.id,
          })
            .orderBy((row) => row.paymentDate.desc())
            .all(),
        ]);
        const paid = payments.reduce((sum, payment) => sum + moneyToCents(payment.amount), 0n);
        const net = moneyToCents(entry.netPay);
        return {
          ...entry,
          components,
          payments,
          paidAmount: centsToMoney(paid),
          outstandingAmount: centsToMoney(net - paid),
          paymentStatus: paid === 0n ? "UNPAID" : paid < net ? "PARTIALLY_PAID" : "PAID",
        };
      }),
    );
    const auditEvents = await this.db.orm.public.PayrollAuditEvent.where({
      organizationId: this.organizationId,
      payrollRunId: id,
    })
      .orderBy((row) => row.createdAt.desc())
      .limit(100)
      .all();
    return { ...run, entries: detailed, auditEvents };
  }
  async create(input: CreatePayrollRunDto) {
    const from = this.instant(input.periodStart);
    const to = this.instant(input.periodEnd);
    if (Temporal.Instant.compare(from, to) > 0)
      throw new BadRequestException("Period end must follow start");
    if (Temporal.Instant.compare(this.instant(input.paymentDate), to) < 0)
      throw new BadRequestException("Payment date cannot be before period end");
    const organization = await this.db.orm.public.Organization.where({ id: this.organizationId })
      .select("currency", "name")
      .first();
    if (!organization) throw new NotFoundException("Organization not found");
    const run = await this.db.orm.public.PayrollRun.create({
      organizationId: this.organizationId,
      name: input.name.trim(),
      periodStart: from,
      periodEnd: to,
      paymentDate: this.instant(input.paymentDate),
      currency: organization.currency,
      organizationName: organization.name,
      createdById: this.userId,
    });
    await this.audit(run.id, null, "CREATED", input.employeeIds?.join(",") ?? null);
    return run;
  }
  private audit(
    payrollRunId: string,
    payrollEntryId: string | null,
    action:
      | "CREATED"
      | "CALCULATED"
      | "ADJUSTED"
      | "SUBMITTED"
      | "APPROVED"
      | "REJECTED"
      | "FINALIZED"
      | "PAYSLIP_GENERATED"
      | "PAYSLIP_FAILED"
      | "PAYMENT_RECORDED",
    details: string | null,
    db: OrmDatabase = this.db,
  ) {
    return db.orm.public.PayrollAuditEvent.create({
      organizationId: this.organizationId,
      payrollRunId,
      payrollEntryId: payrollEntryId ?? undefined,
      actorId: this.userId,
      action,
      details: details ?? undefined,
    });
  }
  async calculate(id: string, expectedVersion: number, selectedEmployeeIds?: string[]) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM payroll_runs WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const run = await tx.orm.public.PayrollRun.where({ organizationId, id }).first();
      if (!run) throw new NotFoundException("Payroll run not found");
      if (run.status !== "DRAFT" || run.version !== expectedVersion)
        throw new ConflictException("Payroll changed. Reload and try again.");
      let employees = await tx.orm.public.Employee.where({ organizationId }).all();
      employees = employees.filter(
        (employee) =>
          ["ACTIVE", "ON_LEAVE"].includes(employee.status) &&
          (!selectedEmployeeIds?.length || selectedEmployeeIds.includes(employee.id)),
      );
      if (selectedEmployeeIds?.length && new Set(selectedEmployeeIds).size !== employees.length)
        throw new BadRequestException(
          "One or more selected employees are unavailable in this organization",
        );
      if (!employees.length) throw new BadRequestException("No eligible employees were found");
      const start = this.day(run.periodStart);
      const end = this.day(run.periodEnd);
      const prepared: Array<{
        employee: EmployeeRow;
        salary: SalaryRow;
        departmentName: string | null;
        components: SalaryComponentRow[];
        amounts: ReturnType<typeof calculateFixedPayroll>;
      }> = [];
      for (const employee of employees) {
        if (
          this.day(employee.hireDate) > start ||
          (employee.terminationDate && this.day(employee.terminationDate) < end)
        )
          throw new BadRequestException(
            `${employee.firstName} ${employee.lastName} does not cover the full pay period; proration is not configured`,
          );
        const salaries = (
          await tx.orm.public.SalaryStructure.where({
            organizationId,
            employeeId: employee.id,
          }).all()
        ).filter(
          (salary) =>
            this.day(salary.effectiveFrom) <= start &&
            (!salary.effectiveTo || this.day(salary.effectiveTo) >= end),
        );
        if (salaries.length !== 1)
          throw new BadRequestException(
            `${employee.firstName} ${employee.lastName} needs exactly one salary structure covering the full pay period`,
          );
        const salary = salaries[0]!;
        if (salary.compensationType !== "FIXED_SALARY")
          throw new BadRequestException(
            `${employee.firstName} ${employee.lastName} uses hourly pay; hours entry is not available yet`,
          );
        if (salary.currency !== run.currency)
          throw new BadRequestException(
            `${employee.firstName} ${employee.lastName}'s salary currency does not match this payroll`,
          );
        try {
          validatePayPeriod(start, end, salary.payFrequency);
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }
        const components = await tx.orm.public.SalaryComponent.where({
          organizationId,
          salaryStructureId: salary.id,
        })
          .orderBy((row) => row.sortOrder.asc())
          .all();
        let amounts: ReturnType<typeof calculateFixedPayroll>;
        try {
          amounts = calculateFixedPayroll(salary.baseAmount, components);
        } catch (error) {
          throw new BadRequestException(
            `${employee.firstName} ${employee.lastName}: ${(error as Error).message}`,
          );
        }
        const department = employee.departmentId
          ? await tx.orm.public.Department.where({ organizationId, id: employee.departmentId })
              .select("name")
              .first()
          : null;
        prepared.push({
          employee,
          salary,
          departmentName: department?.name ?? null,
          components,
          amounts,
        });
      }
      await tx.orm.public.PayrollEntry.where({ organizationId, payrollRunId: id }).deleteAll();
      let gross = 0n,
        deductions = 0n,
        net = 0n;
      for (const item of prepared) {
        const entry = await tx.orm.public.PayrollEntry.create({
          organizationId,
          payrollRunId: id,
          employeeId: item.employee.id,
          salaryStructureId: item.salary.id,
          employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
          employeeCode: item.employee.employeeCode,
          departmentName: item.departmentName ?? undefined,
          jobTitle: item.employee.jobTitle,
          compensationType: item.salary.compensationType,
          payFrequency: item.salary.payFrequency,
          baseAmount: payrollAmount(item.amounts.baseAmount),
          grossPay: payrollAmount(item.amounts.grossPay),
          totalDeductions: payrollAmount(item.amounts.totalDeductions),
          netPay: payrollAmount(item.amounts.netPay),
        });
        for (const component of item.components)
          await tx.orm.public.PayrollEntryComponent.create({
            organizationId,
            payrollEntryId: entry.id,
            name: component.name,
            type: component.type,
            amount: payrollAmount(component.amount),
            sourceSalaryComponentId: component.id,
            sortOrder: component.sortOrder,
          });
        gross += moneyToCents(item.amounts.grossPay);
        deductions += moneyToCents(item.amounts.totalDeductions);
        net += moneyToCents(item.amounts.netPay);
      }
      const [updated] = await tx.orm.public.PayrollRun.where({
        organizationId,
        id,
        status: "DRAFT",
        version: expectedVersion,
      }).updateAll({
        totalGross: payrollAmount(centsToMoney(gross)),
        totalDeductions: payrollAmount(centsToMoney(deductions)),
        totalNet: payrollAmount(centsToMoney(net)),
        employeeCount: prepared.length,
        version: expectedVersion + 1,
      });
      if (!updated) throw new ConflictException("Payroll changed. Reload and try again.");
      await this.audit(id, null, "CALCULATED", `${prepared.length} employees`, tx);
      return updated;
    });
  }
  private async recomputeRun(tx: OrmDatabase, runId: string) {
    const entries = await tx.orm.public.PayrollEntry.where({
      organizationId: this.organizationId,
      payrollRunId: runId,
    }).all();
    return {
      totalGross: payrollAmount(
        centsToMoney(entries.reduce((sum, row) => sum + moneyToCents(row.grossPay), 0n)),
      ),
      totalDeductions: payrollAmount(
        centsToMoney(entries.reduce((sum, row) => sum + moneyToCents(row.totalDeductions), 0n)),
      ),
      totalNet: payrollAmount(
        centsToMoney(entries.reduce((sum, row) => sum + moneyToCents(row.netPay), 0n)),
      ),
    };
  }
  async adjust(runId: string, entryId: string, input: PayrollAdjustmentDto) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM payroll_runs WHERE id = ${runId} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const run = await tx.orm.public.PayrollRun.where({ organizationId, id: runId }).first();
      const entry = await tx.orm.public.PayrollEntry.where({
        organizationId,
        id: entryId,
        payrollRunId: runId,
      }).first();
      if (!run || !entry) throw new NotFoundException("Payroll entry not found");
      if (run.status !== "DRAFT" || run.version !== input.expectedVersion)
        throw new ConflictException("Only the current draft payroll can be adjusted");
      await tx.orm.public.PayrollEntryComponent.create({
        organizationId,
        payrollEntryId: entryId,
        name: input.name.trim(),
        type: input.type,
        amount: payrollAmount(input.amount),
        isAdjustment: true,
        sortOrder: 10000,
      });
      const components = await tx.orm.public.PayrollEntryComponent.where({
        organizationId,
        payrollEntryId: entryId,
      }).all();
      let amounts: ReturnType<typeof calculateFixedPayroll>;
      try {
        amounts = calculateFixedPayroll(entry.baseAmount, components);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
      await tx.orm.public.PayrollEntry.where({ organizationId, id: entryId }).update({
        baseAmount: payrollAmount(amounts.baseAmount),
        grossPay: payrollAmount(amounts.grossPay),
        totalDeductions: payrollAmount(amounts.totalDeductions),
        netPay: payrollAmount(amounts.netPay),
        version: entry.version + 1,
      });
      const totals = await this.recomputeRun(tx, runId);
      const [updated] = await tx.orm.public.PayrollRun.where({
        organizationId,
        id: runId,
        version: input.expectedVersion,
      }).updateAll({ ...totals, version: input.expectedVersion + 1 });
      if (!updated) throw new ConflictException("Payroll changed. Reload and try again.");
      await this.audit(
        runId,
        entryId,
        "ADJUSTED",
        `${input.type}:${input.name}:${input.amount}`,
        tx,
      );
      return updated;
    });
  }
  private async transition(
    id: string,
    expectedVersion: number,
    from: RunStatus,
    to: RunStatus,
    reason?: string,
  ) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM payroll_runs WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const run = await tx.orm.public.PayrollRun.where({ organizationId, id }).first();
      if (!run) throw new NotFoundException("Payroll run not found");
      if (run.status !== from || run.version !== expectedVersion)
        throw new ConflictException(
          "Payroll changed or is no longer eligible. Reload and try again.",
        );
      if (to === "PENDING_APPROVAL" && run.employeeCount < 1)
        throw new BadRequestException("Calculate payroll before submitting it");
      if (to === "APPROVED" && run.createdById === this.userId)
        throw new ForbiddenException("The payroll creator cannot approve their own run");
      if (to === "FINALIZED") {
        const currentEntries = await tx.orm.public.PayrollEntry.where({
          organizationId,
          payrollRunId: id,
        }).all();
        if (!currentEntries.length) throw new BadRequestException("Payroll has no entries");
        let verifiedGross = 0n;
        let verifiedDeductions = 0n;
        let verifiedNet = 0n;
        for (const entry of currentEntries) {
          const employee = await tx.orm.public.Employee.where({
            organizationId,
            id: entry.employeeId,
          }).first();
          const salary = await tx.orm.public.SalaryStructure.where({
            organizationId,
            id: entry.salaryStructureId,
            employeeId: entry.employeeId,
          }).first();
          if (!employee || !salary)
            throw new ConflictException(
              `${entry.employeeName}'s employee or salary record is unavailable`,
            );
          if (
            !["ACTIVE", "ON_LEAVE"].includes(employee.status) ||
            this.day(employee.hireDate) > this.day(run.periodStart) ||
            (employee.terminationDate &&
              this.day(employee.terminationDate) < this.day(run.periodEnd))
          )
            throw new ConflictException(
              `${entry.employeeName}'s employment eligibility changed; return the run to draft and recalculate`,
            );
          if (
            salary.compensationType !== entry.compensationType ||
            salary.payFrequency !== entry.payFrequency ||
            salary.currency !== run.currency ||
            String(salary.baseAmount) !== String(entry.baseAmount) ||
            this.day(salary.effectiveFrom) > this.day(run.periodStart) ||
            (salary.effectiveTo && this.day(salary.effectiveTo) < this.day(run.periodEnd))
          )
            throw new ConflictException(
              `${entry.employeeName}'s salary changed; return the run to draft and recalculate`,
            );
          const source = await tx.orm.public.SalaryComponent.where({
            organizationId,
            salaryStructureId: salary.id,
          })
            .orderBy((row) => row.sortOrder.asc())
            .all();
          const snapshots = (
            await tx.orm.public.PayrollEntryComponent.where({
              organizationId,
              payrollEntryId: entry.id,
            })
              .orderBy((row) => row.sortOrder.asc())
              .all()
          ).filter((component) => !component.isAdjustment);
          if (
            source.length !== snapshots.length ||
            source.some((component, index) => {
              const snapshot = snapshots[index];
              return (
                !snapshot ||
                snapshot.sourceSalaryComponentId !== component.id ||
                snapshot.name !== component.name ||
                snapshot.type !== component.type ||
                String(snapshot.amount) !== String(component.amount)
              );
            })
          )
            throw new ConflictException(
              `${entry.employeeName}'s salary components changed; return the run to draft and recalculate`,
            );
          verifiedGross += moneyToCents(entry.grossPay);
          verifiedDeductions += moneyToCents(entry.totalDeductions);
          verifiedNet += moneyToCents(entry.netPay);
        }
        if (
          centsToMoney(verifiedGross) !== run.totalGross ||
          centsToMoney(verifiedDeductions) !== run.totalDeductions ||
          centsToMoney(verifiedNet) !== run.totalNet
        )
          throw new ConflictException(
            "Payroll totals are inconsistent; return the run to draft and recalculate",
          );
        const finalizedRuns = (
          await tx.orm.public.PayrollRun.where({ organizationId, status: "FINALIZED" }).all()
        ).filter(
          (other) =>
            this.day(other.periodStart) <= this.day(run.periodEnd) &&
            this.day(other.periodEnd) >= this.day(run.periodStart),
        );
        for (const other of finalizedRuns) {
          const existingEntries = await tx.orm.public.PayrollEntry.where({
            organizationId,
            payrollRunId: other.id,
          }).all();
          const duplicate = currentEntries.find((entry) =>
            existingEntries.some((existing) => existing.employeeId === entry.employeeId),
          );
          if (duplicate)
            throw new ConflictException(
              `${duplicate.employeeName} already belongs to a finalized payroll for an overlapping period`,
            );
        }
      }
      const now = Temporal.Now.instant();
      const [updated] = await tx.orm.public.PayrollRun.where({
        organizationId,
        id,
        status: from,
        version: expectedVersion,
      }).updateAll({
        status: to,
        version: expectedVersion + 1,
        rejectionReason: to === "DRAFT" ? reason : null,
        ...(to === "APPROVED" ? { approvedById: this.userId, approvedAt: now } : {}),
        ...(to === "DRAFT" ? { approvedById: null, approvedAt: null } : {}),
        ...(to === "FINALIZED" ? { finalizedById: this.userId, finalizedAt: now } : {}),
      });
      if (!updated) throw new ConflictException("Payroll changed. Reload and try again.");
      await this.audit(
        id,
        null,
        to === "PENDING_APPROVAL" ? "SUBMITTED" : to === "DRAFT" ? "REJECTED" : to,
        reason ?? null,
        tx,
      );
      return updated;
    });
  }
  submit(id: string, expectedVersion: number) {
    return this.transition(id, expectedVersion, "DRAFT", "PENDING_APPROVAL");
  }
  approve(id: string, expectedVersion: number) {
    return this.transition(id, expectedVersion, "PENDING_APPROVAL", "APPROVED");
  }
  reject(id: string, expectedVersion: number, reason: string) {
    return this.transition(id, expectedVersion, "PENDING_APPROVAL", "DRAFT", reason.trim());
  }
  async finalize(id: string, expectedVersion: number) {
    const result = await this.transition(id, expectedVersion, "APPROVED", "FINALIZED");
    const entries = await this.db.orm.public.PayrollEntry.where({
      organizationId: this.organizationId,
      payrollRunId: id,
    }).all();
    try {
      await Promise.all(
        entries.map((entry) =>
          this.payslips.enqueue(this.organizationId, id, entry.id, this.userId),
        ),
      );
    } catch {
      // Finalized financial snapshots remain valid; failed queueing is visible and retryable.
      await this.db.orm.public.PayrollEntry.where({
        organizationId: this.organizationId,
        payrollRunId: id,
      }).updateAll({ payslipStatus: "FAILED", payslipFailureCode: "QUEUE_UNAVAILABLE" });
      return {
        ...result,
        payslipQueueStatus: "FAILED",
        payslipQueueMessage:
          "Payroll is finalized. Retry payslip generation when the worker is available.",
      };
    }
    return { ...result, payslipQueueStatus: "QUEUED" };
  }
  async recordPayment(runId: string, entryId: string, input: RecordPayrollPaymentDto) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM payroll_entries WHERE id = ${entryId} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const run = await tx.orm.public.PayrollRun.where({ organizationId, id: runId }).first();
      const entry = await tx.orm.public.PayrollEntry.where({
        organizationId,
        id: entryId,
        payrollRunId: runId,
      }).first();
      if (!run || !entry) throw new NotFoundException("Payroll entry not found");
      if (run.status !== "FINALIZED")
        throw new ConflictException("Payments require finalized payroll");
      const existingKey = await tx.orm.public.PayrollPayment.where({
        organizationId,
        idempotencyKey: input.idempotencyKey,
      }).first();
      if (existingKey) {
        if (
          existingKey.payrollEntryId !== entryId ||
          moneyToCents(existingKey.amount) !== moneyToCents(input.amount) ||
          existingKey.reference !== input.reference.trim()
        )
          throw new ConflictException("This idempotency key was already used for another payment");
        return existingKey;
      }
      const payments = await tx.orm.public.PayrollPayment.where({
        organizationId,
        payrollEntryId: entryId,
      }).all();
      const paid = payments.reduce((sum, payment) => sum + moneyToCents(payment.amount), 0n);
      const amount = moneyToCents(input.amount);
      if (amount <= 0n || paid + amount > moneyToCents(entry.netPay))
        throw new BadRequestException("Payment must be positive and cannot exceed outstanding pay");
      const payment = await tx.orm.public.PayrollPayment.create({
        organizationId,
        payrollEntryId: entryId,
        amount: payrollAmount(input.amount),
        paymentDate: this.instant(input.paymentDate),
        reference: input.reference.trim(),
        notes: input.notes?.trim(),
        idempotencyKey: input.idempotencyKey,
        recordedById: this.userId,
      });
      await this.audit(runId, entryId, "PAYMENT_RECORDED", input.amount, tx);
      return payment;
    });
  }
  async retryPayslip(runId: string, entryId: string) {
    const run = await this.run(runId);
    const entry = await this.db.orm.public.PayrollEntry.where({
      organizationId: this.organizationId,
      id: entryId,
      payrollRunId: runId,
    }).first();
    if (!entry) throw new NotFoundException("Payroll entry not found");
    if (run.status !== "FINALIZED")
      throw new ConflictException("Payslips require finalized payroll");
    if (entry.payslipStatus === "PROCESSING")
      throw new ConflictException("Payslip is already processing");
    if (entry.payslipKey) throw new ConflictException("Payslip already exists");
    await this.db.orm.public.PayrollEntry.where({
      organizationId: this.organizationId,
      id: entryId,
    }).update({ payslipStatus: "PENDING", payslipFailureCode: null });
    await this.payslips.enqueue(this.organizationId, runId, entryId, this.userId);
    return { status: "PENDING" };
  }
  async getPayslip(runId: string, entryId: string) {
    await this.run(runId);
    const entry = await this.db.orm.public.PayrollEntry.where({
      organizationId: this.organizationId,
      id: entryId,
      payrollRunId: runId,
    }).first();
    if (!entry) throw new NotFoundException("Payroll entry not found");
    if (entry.payslipStatus !== "COMPLETED" || !entry.payslipKey)
      throw new NotFoundException("Payslip is not available");
    return {
      entry,
      buffer: await this.payslipStorage.get(entry.payslipKey, this.organizationId, runId, entryId),
    };
  }
}
