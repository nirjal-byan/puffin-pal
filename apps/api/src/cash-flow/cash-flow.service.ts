import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Temporal } from "temporal-polyfill";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { nextOccurrence } from "../recurring-invoices/recurring-schedule.js";
import type { CashFlowForecastQueryDto, UpdateCashFlowConfigurationDto } from "./cash-flow.dto.js";
import {
  addDays,
  buildCashFlowForecast,
  isoDate,
  moneyToCents,
  type ForecastEvent,
} from "./cash-flow-forecast.engine.js";

const DEFAULTS = {
  openingBalance: null,
  openingBalanceDate: null,
  defaultHorizonDays: 30,
  expectedInvoiceCollectionDelay: 7,
  conservativeDelayAdjustmentDays: 14,
  optimisticDelayAdjustmentDays: 0,
  includeRecurringInvoices: true,
  includeApprovedPayroll: true,
  includeSalaryEstimates: false,
  includeApprovedExpenses: false,
  version: 0,
} as const;

const date = (value: { toString(): string } | string) => value.toString().slice(0, 10);
const instant = (value: string) => Temporal.Instant.from(`${value}T00:00:00Z`);
const forecastAmount = (value: string | null) => value as Numeric<14, 2> | null;

@Injectable({ scope: Scope.REQUEST })
export class CashFlowService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}

  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }

  async configuration() {
    const stored = await this.db.orm.public.CashFlowForecastConfiguration.where({
      organizationId: this.tenant.organizationId,
    }).first();
    return stored ?? { organizationId: this.tenant.organizationId, ...DEFAULTS };
  }

  async updateConfiguration(input: UpdateCashFlowConfigurationDto) {
    const { organizationId, userId } = this.tenant;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw.sql`SELECT id FROM organizations WHERE id = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const current = await tx.orm.public.CashFlowForecastConfiguration.where({
        organizationId,
      }).first();
      const version = current?.version ?? 0;
      if (version !== input.expectedVersion)
        throw new ConflictException("Forecast settings changed. Reload and try again.");
      const nextBalance =
        input.openingBalance === undefined
          ? (current?.openingBalance ?? null)
          : input.openingBalance;
      const nextBalanceDate =
        input.openingBalanceDate === undefined
          ? (current?.openingBalanceDate ?? null)
          : input.openingBalanceDate;
      if ((nextBalance === null) !== (nextBalanceDate === null))
        throw new BadRequestException(
          "Opening balance and balance date must be set or cleared together",
        );
      const data = {
        ...(input.openingBalance !== undefined
          ? { openingBalance: forecastAmount(input.openingBalance) }
          : {}),
        ...(input.openingBalanceDate !== undefined
          ? {
              openingBalanceDate: input.openingBalanceDate
                ? instant(input.openingBalanceDate)
                : null,
            }
          : {}),
        ...(input.defaultHorizonDays !== undefined
          ? { defaultHorizonDays: input.defaultHorizonDays }
          : {}),
        ...(input.expectedInvoiceCollectionDelay !== undefined
          ? { expectedInvoiceCollectionDelay: input.expectedInvoiceCollectionDelay }
          : {}),
        ...(input.conservativeDelayAdjustmentDays !== undefined
          ? { conservativeDelayAdjustmentDays: input.conservativeDelayAdjustmentDays }
          : {}),
        ...(input.optimisticDelayAdjustmentDays !== undefined
          ? { optimisticDelayAdjustmentDays: input.optimisticDelayAdjustmentDays }
          : {}),
        ...(input.includeRecurringInvoices !== undefined
          ? { includeRecurringInvoices: input.includeRecurringInvoices }
          : {}),
        ...(input.includeApprovedPayroll !== undefined
          ? { includeApprovedPayroll: input.includeApprovedPayroll }
          : {}),
        ...(input.includeSalaryEstimates !== undefined
          ? { includeSalaryEstimates: input.includeSalaryEstimates }
          : {}),
        ...(input.includeApprovedExpenses !== undefined
          ? { includeApprovedExpenses: input.includeApprovedExpenses }
          : {}),
        updatedById: userId,
        version: version + 1,
      };
      const updated = current
        ? (
            await tx.orm.public.CashFlowForecastConfiguration.where({
              organizationId,
              version,
            }).updateAll(data)
          )[0]
        : await tx.orm.public.CashFlowForecastConfiguration.create({ organizationId, ...data });
      if (!updated) throw new ConflictException("Forecast settings changed. Reload and try again.");
      await tx.orm.public.CashFlowForecastAuditEvent.create({
        organizationId,
        actorId: userId,
        action: "CONFIGURATION_UPDATED",
        details: JSON.stringify({
          changedFields: Object.keys(input).filter((key) => key !== "expectedVersion"),
          version: version + 1,
        }),
      });
      return updated;
    });
  }

  async forecast(query: CashFlowForecastQueryDto) {
    const organizationId = this.tenant.organizationId;
    const today = isoDate(new Date());
    const from = query.from ?? today;
    try {
      instant(from);
    } catch {
      throw new BadRequestException("Provide a valid forecast start date");
    }
    const [organization, configuration] = await Promise.all([
      this.db.orm.public.Organization.where({ id: organizationId }).select("currency").first(),
      this.configuration(),
    ]);
    if (!organization) throw new UnauthorizedException();
    const horizonDays = query.horizonDays ?? configuration.defaultHorizonDays;
    const to = addDays(from, horizonDays - 1);
    const events: ForecastEvent[] = [];
    const warnings = [
      "Forecasts are deterministic planning estimates, not guarantees.",
      "Past approved expenses are excluded because expenses do not track payment state.",
    ];

    await Promise.all([
      this.invoiceEvents(organizationId, organization.currency, from, events),
      configuration.includeRecurringInvoices
        ? this.recurringEvents(organizationId, organization.currency, from, to, events)
        : Promise.resolve(),
      this.payrollEvents(
        organizationId,
        organization.currency,
        from,
        configuration.includeApprovedPayroll,
        events,
      ),
      configuration.includeSalaryEstimates
        ? this.salaryEvents(organizationId, organization.currency, from, to, events)
        : Promise.resolve(),
      configuration.includeApprovedExpenses
        ? this.expenseEvents(organizationId, from, to, events)
        : Promise.resolve(),
    ]);
    if (configuration.includeApprovedExpenses)
      warnings.push(
        "Approved future-dated expenses use their expense date as an assumed cash date.",
      );
    if (configuration.includeSalaryEstimates)
      warnings.push(
        "Salary estimates use active fixed salary structures and exclude dates covered by existing payroll runs.",
      );

    const openingBalance =
      configuration.openingBalance !== null &&
      configuration.openingBalanceDate !== null &&
      date(configuration.openingBalanceDate) <= from
        ? moneyToCents(configuration.openingBalance)
        : null;
    if (configuration.openingBalance !== null && openingBalance === null)
      warnings.push(
        "The configured opening balance starts after this forecast range and was not applied.",
      );
    const result = buildCashFlowForecast({
      from,
      horizonDays,
      scenario: query.scenario,
      currency: organization.currency,
      openingBalanceCents: openingBalance,
      expectedCollectionDelayDays: configuration.expectedInvoiceCollectionDelay,
      conservativeDelayAdjustmentDays: configuration.conservativeDelayAdjustmentDays,
      optimisticDelayAdjustmentDays: configuration.optimisticDelayAdjustmentDays,
      events,
    });
    return { ...result, configuration, warnings };
  }

  private async invoiceEvents(
    organizationId: string,
    currency: string,
    from: string,
    events: ForecastEvent[],
  ) {
    const [invoices, payments] = await Promise.all([
      this.db.orm.public.Invoice.where({ organizationId }).all(),
      this.db.orm.public.Payment.where({ organizationId }).all(),
    ]);
    const paid = new Map<string, bigint>();
    for (const payment of payments)
      paid.set(
        payment.invoiceId,
        (paid.get(payment.invoiceId) ?? 0n) + moneyToCents(payment.amount),
      );
    for (const invoice of invoices) {
      if (!["ISSUED", "PENDING", "OVERDUE"].includes(invoice.status)) continue;
      if (invoice.currency && invoice.currency !== currency)
        throw new ConflictException("Cash flow forecasting requires one organization currency");
      const outstanding = moneyToCents(invoice.total) - (paid.get(invoice.id) ?? 0n);
      if (outstanding <= 0n) continue;
      const due = date(invoice.dueDate);
      events.push({
        id: `invoice:${invoice.id}`,
        source: "INVOICE",
        direction: "INFLOW",
        date: due < from ? from : due,
        amountCents: outstanding,
        label: invoice.invoiceNumber,
        overdue: due < from,
        scenarioDelay: true,
      });
    }
  }

  private async recurringEvents(
    organizationId: string,
    currency: string,
    from: string,
    to: string,
    events: ForecastEvent[],
  ) {
    const [schedules, items, occurrences] = await Promise.all([
      this.db.orm.public.RecurringInvoiceSchedule.where({ organizationId, status: "ACTIVE" }).all(),
      this.db.orm.public.RecurringInvoiceItem.where({ organizationId }).all(),
      this.db.orm.public.RecurringInvoiceOccurrence.where({ organizationId }).all(),
    ]);
    const generatedSlots = new Set(
      occurrences
        .filter((row) => row.invoiceId)
        .map((row) => `${row.scheduleId}:${date(row.scheduledFor)}`),
    );
    for (const schedule of schedules) {
      if (schedule.currency !== currency)
        throw new ConflictException("Cash flow forecasting requires one organization currency");
      let occurrence = schedule.nextRunAt;
      let guard = 0;
      const amount = items
        .filter((item) => item.scheduleId === schedule.id)
        .reduce((sum, item) => sum + moneyToCents(item.amount), 0n);
      while (date(occurrence) <= to && guard++ < 400) {
        const slot = date(occurrence);
        if (
          slot >= from &&
          (!schedule.endDate || slot <= date(schedule.endDate)) &&
          !generatedSlots.has(`${schedule.id}:${slot}`)
        )
          events.push({
            id: `recurring:${schedule.id}:${slot}`,
            source: "RECURRING_INVOICE",
            direction: "INFLOW",
            date: addDays(slot, schedule.dueDateOffsetDays),
            amountCents: amount,
            label: schedule.name,
            assumption: "Projected from an active recurring schedule; no invoice was created.",
            scenarioDelay: true,
          });
        occurrence = nextOccurrence(
          occurrence,
          schedule.startDate,
          schedule.frequency,
          schedule.interval,
        );
      }
    }
  }

  private async payrollEvents(
    organizationId: string,
    currency: string,
    from: string,
    includeApproved: boolean,
    events: ForecastEvent[],
  ) {
    const allowed = includeApproved ? ["FINALIZED", "APPROVED"] : ["FINALIZED"];
    const [runs, entries, payments] = await Promise.all([
      this.db.orm.public.PayrollRun.where({ organizationId }).all(),
      this.db.orm.public.PayrollEntry.where({ organizationId }).all(),
      this.db.orm.public.PayrollPayment.where({ organizationId }).all(),
    ]);
    const paid = new Map<string, bigint>();
    for (const payment of payments)
      paid.set(
        payment.payrollEntryId,
        (paid.get(payment.payrollEntryId) ?? 0n) + moneyToCents(payment.amount),
      );
    for (const run of runs.filter((row) => allowed.includes(row.status))) {
      if (run.currency !== currency)
        throw new ConflictException("Cash flow forecasting requires one organization currency");
      const amount = entries
        .filter((entry) => entry.payrollRunId === run.id)
        .reduce((sum, entry) => sum + moneyToCents(entry.netPay) - (paid.get(entry.id) ?? 0n), 0n);
      if (amount <= 0n) continue;
      events.push({
        id: `payroll:${run.id}`,
        source: run.status === "FINALIZED" ? "FINALIZED_PAYROLL" : "APPROVED_PAYROLL",
        direction: "OUTFLOW",
        date: date(run.paymentDate) < from ? from : date(run.paymentDate),
        amountCents: amount,
        label: run.name,
        assumption:
          run.status === "APPROVED"
            ? "Approved payroll is not finalized and may still change."
            : undefined,
      });
    }
  }

  private async salaryEvents(
    organizationId: string,
    currency: string,
    from: string,
    to: string,
    events: ForecastEvent[],
  ) {
    const [employees, structures, components, runs] = await Promise.all([
      this.db.orm.public.Employee.where({ organizationId, status: "ACTIVE" }).all(),
      this.db.orm.public.SalaryStructure.where({ organizationId }).all(),
      this.db.orm.public.SalaryComponent.where({ organizationId }).all(),
      this.db.orm.public.PayrollRun.where({ organizationId }).all(),
    ]);
    const activeEmployees = new Set(employees.map((employee) => employee.id));
    for (const structure of structures) {
      if (
        !activeEmployees.has(structure.employeeId) ||
        structure.compensationType !== "FIXED_SALARY"
      )
        continue;
      if (structure.currency !== currency)
        throw new ConflictException("Cash flow forecasting requires one organization currency");
      const effectiveFrom = date(structure.effectiveFrom);
      const effectiveTo = structure.effectiveTo ? date(structure.effectiveTo) : to;
      const additions = components
        .filter((item) => item.salaryStructureId === structure.id)
        .reduce(
          (sum, item) =>
            sum +
            (item.type === "EARNING" ? moneyToCents(item.amount) : -moneyToCents(item.amount)),
          0n,
        );
      const amount = moneyToCents(structure.baseAmount) + additions;
      const step =
        structure.payFrequency === "WEEKLY" ? 7 : structure.payFrequency === "BIWEEKLY" ? 14 : 30;
      for (
        let paymentDate = effectiveFrom;
        paymentDate <= to;
        paymentDate = addDays(paymentDate, step)
      ) {
        if (paymentDate < from || paymentDate > effectiveTo) continue;
        if (
          runs.some(
            (run) => date(run.periodStart) <= paymentDate && date(run.periodEnd) >= paymentDate,
          )
        )
          continue;
        events.push({
          id: `salary:${structure.id}:${paymentDate}`,
          source: "SALARY_ESTIMATE",
          direction: "OUTFLOW",
          date: paymentDate,
          amountCents: amount,
          label: "Estimated salary obligation",
          assumption: `Estimated from a ${structure.payFrequency.toLowerCase()} fixed salary structure.`,
        });
      }
    }
  }

  private async expenseEvents(
    organizationId: string,
    from: string,
    to: string,
    events: ForecastEvent[],
  ) {
    const expenses = await this.db.orm.public.Expense.where({
      organizationId,
      approvalStatus: "APPROVED",
    }).all();
    for (const expense of expenses) {
      const expenseDate = date(expense.date);
      if (expenseDate < from || expenseDate > to) continue;
      events.push({
        id: `expense:${expense.id}`,
        source: "APPROVED_EXPENSE",
        direction: "OUTFLOW",
        date: expenseDate,
        amountCents: moneyToCents(expense.amount),
        label: expense.title,
        assumption:
          "The expense date is used as the planned cash date; payment state is unavailable.",
      });
    }
  }
}
