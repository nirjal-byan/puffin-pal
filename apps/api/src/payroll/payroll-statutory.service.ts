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
import { createHash } from "node:crypto";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { calculateStatutory, validateBrackets } from "./statutory-calculations.js";
import { centsToMoney, moneyToCents, payrollAmount } from "./payroll-calculations.js";
import type {
  ApplyStatutoryDto,
  ComponentClassificationDto,
  CreateStatutoryRuleSetDto,
  JurisdictionDto,
} from "./payroll-statutory.dto.js";

type OrmDatabase = Pick<Database, "orm">;
const rateValue = (value?: string) => (value ?? null) as Numeric<9, 6> | null;

@Injectable({ scope: Scope.REQUEST })
export class PayrollStatutoryService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}
  private get auth() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }
  private get organizationId() {
    return this.auth.organizationId;
  }
  private instant(day: string) {
    return Temporal.Instant.from(`${day}T00:00:00Z`);
  }
  private day(value: { toString(): string }) {
    return value.toString().slice(0, 10);
  }
  private audit(
    entityType: string,
    entityId: string,
    action: string,
    details?: unknown,
    db: OrmDatabase = this.db,
  ) {
    return db.orm.public.PayrollStatutoryAuditEvent.create({
      organizationId: this.organizationId,
      actorId: this.auth.userId,
      entityType,
      entityId,
      action,
      details: details === undefined ? null : JSON.stringify(details),
    });
  }

  jurisdictions() {
    return this.db.orm.public.PayrollTaxJurisdiction.where({
      organizationId: this.organizationId,
    }).all();
  }
  async saveJurisdiction(input: JurisdictionDto) {
    const existing = (await this.jurisdictions()).find((row) => row.isActive);
    if (
      existing &&
      (existing.countryCode !== input.countryCode ||
        existing.subdivisionCode !== (input.subdivisionCode ?? null) ||
        existing.currency !== input.currency) &&
      (await this.db.orm.public.PayrollStatutoryRuleSet.where({
        organizationId: this.organizationId,
        jurisdictionId: existing.id,
        status: "ACTIVE",
      }).first())
    )
      throw new ConflictException(
        "Create a new jurisdiction instead of changing one used by an active rule version",
      );
    const saved = existing
      ? await this.db.orm.public.PayrollTaxJurisdiction.where({
          organizationId: this.organizationId,
          id: existing.id,
        }).update({
          ...input,
          subdivisionCode: input.subdivisionCode ?? null,
          version: existing.version + 1,
        })
      : await this.db.orm.public.PayrollTaxJurisdiction.create({
          organizationId: this.organizationId,
          ...input,
          subdivisionCode: input.subdivisionCode ?? null,
        });
    await this.audit("JURISDICTION", saved!.id, existing ? "UPDATED" : "CREATED");
    return saved;
  }
  async rules() {
    const sets = await this.db.orm.public.PayrollStatutoryRuleSet.where({
      organizationId: this.organizationId,
    }).all();
    return Promise.all(
      sets.map(async (set) => ({
        ...set,
        brackets: await this.db.orm.public.PayrollTaxBracket.where({
          organizationId: this.organizationId,
          ruleSetId: set.id,
        }).all(),
        rules: await this.db.orm.public.PayrollStatutoryRule.where({
          organizationId: this.organizationId,
          ruleSetId: set.id,
        }).all(),
      })),
    );
  }
  async report() {
    const finalized = await this.db.orm.public.PayrollRun.where({
      organizationId: this.organizationId,
      status: "FINALIZED",
    }).all();
    const runIds = new Set(finalized.map((row) => row.id));
    const entries = (
      await this.db.orm.public.PayrollEntry.where({ organizationId: this.organizationId }).all()
    ).filter((row) => runIds.has(row.payrollRunId));
    const applications = await this.db.orm.public.PayrollStatutoryApplication.where({
      organizationId: this.organizationId,
    }).all();
    const relevant = applications.filter((row) =>
      entries.some((entry) => entry.id === row.payrollEntryId),
    );
    const sum = (
      field:
        | "grossEarnings"
        | "taxWithholding"
        | "employeeContributions"
        | "employerContributions"
        | "netPay"
        | "totalEmployerCost",
    ) => centsToMoney(relevant.reduce((total, row) => total + moneyToCents(row[field]), 0n));
    return {
      finalizedPayrollRuns: finalized.length,
      entries: relevant.length,
      grossEarnings: sum("grossEarnings"),
      taxWithholding: sum("taxWithholding"),
      employeeContributions: sum("employeeContributions"),
      employerContributions: sum("employerContributions"),
      netPay: sum("netPay"),
      totalEmployerCost: sum("totalEmployerCost"),
      disclaimer: "Operational summary only; not an official tax filing.",
    };
  }
  async createRuleSet(input: CreateStatutoryRuleSetDto) {
    validateBrackets(input.brackets);
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom)
      throw new BadRequestException("Effective end must follow the start date");
    if (input.brackets.length && !input.periodsPerYear)
      throw new BadRequestException("Progressive brackets require periods per year");
    for (const rule of input.rules) {
      if (rule.calculationType === "RATE" && !rule.rate)
        throw new BadRequestException(`${rule.name} requires a rate`);
      if (rule.calculationType === "FIXED_AMOUNT" && !rule.fixedAmount)
        throw new BadRequestException(`${rule.name} requires a fixed amount`);
    }
    const jurisdiction = await this.db.orm.public.PayrollTaxJurisdiction.where({
      organizationId: this.organizationId,
      id: input.jurisdictionId,
    }).first();
    if (!jurisdiction) throw new NotFoundException("Tax jurisdiction not found");
    return this.db.transaction(async (tx) => {
      const set = await tx.orm.public.PayrollStatutoryRuleSet.create({
        organizationId: this.organizationId,
        jurisdictionId: input.jurisdictionId,
        name: input.name.trim(),
        version: input.version,
        effectiveFrom: this.instant(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? this.instant(input.effectiveTo) : null,
        periodsPerYear: input.periodsPerYear ?? null,
        createdById: this.auth.userId,
      });
      for (const [sortOrder, bracket] of input.brackets.entries())
        await tx.orm.public.PayrollTaxBracket.create({
          organizationId: this.organizationId,
          ruleSetId: set.id,
          lowerBound: payrollAmount(bracket.lowerBound),
          upperBound: bracket.upperBound ? payrollAmount(bracket.upperBound) : null,
          rate: rateValue(bracket.rate)!,
          sortOrder,
        });
      for (const [sortOrder, rule] of input.rules.entries())
        await tx.orm.public.PayrollStatutoryRule.create({
          organizationId: this.organizationId,
          ruleSetId: set.id,
          name: rule.name,
          kind: rule.kind,
          calculationType: rule.calculationType,
          calculationBase: rule.calculationBase,
          rate: rateValue(rule.rate),
          fixedAmount: rule.fixedAmount ? payrollAmount(rule.fixedAmount) : null,
          minimumBase: rule.minimumBase ? payrollAmount(rule.minimumBase) : null,
          maximumBase: rule.maximumBase ? payrollAmount(rule.maximumBase) : null,
          contributionCap: rule.contributionCap ? payrollAmount(rule.contributionCap) : null,
          sortOrder,
        });
      await this.audit("RULE_SET", set.id, "CREATED", { version: set.version }, tx);
      return set;
    });
  }
  async activate(id: string, expectedVersion: number) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId + ":statutory-rules"}))`
          .affectedCount()
          .build(),
      );
      const set = await tx.orm.public.PayrollStatutoryRuleSet.where({
        organizationId,
        id,
      }).first();
      if (!set || set.status !== "DRAFT" || set.version !== expectedVersion)
        throw new ConflictException("Only the current draft rule version can be activated");
      const active = await tx.orm.public.PayrollStatutoryRuleSet.where({
        organizationId,
        jurisdictionId: set.jurisdictionId,
        status: "ACTIVE",
      }).all();
      for (const row of active) {
        const overlaps =
          this.day(row.effectiveFrom) <=
            (set.effectiveTo ? this.day(set.effectiveTo) : "9999-12-31") &&
          (!row.effectiveTo || this.day(row.effectiveTo) >= this.day(set.effectiveFrom));
        if (!overlaps) continue;
        if (this.day(set.effectiveFrom) <= this.day(row.effectiveFrom))
          throw new ConflictException("The new version must start after the active version");
        await tx.orm.public.PayrollStatutoryRuleSet.where({
          organizationId,
          id: row.id,
        }).update({
          status: "SUPERSEDED",
          effectiveTo: this.instant(
            Temporal.PlainDate.from(this.day(set.effectiveFrom)).subtract({ days: 1 }).toString(),
          ),
        });
        await this.audit("RULE_SET", row.id, "SUPERSEDED", { byRuleSetId: id }, tx);
      }
      const activated = await tx.orm.public.PayrollStatutoryRuleSet.where({
        organizationId,
        id,
        version: expectedVersion,
      }).update({
        status: "ACTIVE",
        activatedById: this.auth.userId,
        activatedAt: Temporal.Now.instant(),
      });
      await this.audit("RULE_SET", id, "ACTIVATED", { version: set.version }, tx);
      return activated;
    });
  }
  async classify(componentId: string, input: ComponentClassificationDto) {
    const updated = await this.db.orm.public.SalaryComponent.where({
      organizationId: this.organizationId,
      id: componentId,
    }).update({ statutoryClass: input.statutoryClass });
    if (!updated) throw new NotFoundException("Salary component not found");
    await this.audit("SALARY_COMPONENT", componentId, "CLASSIFIED", input);
    return updated;
  }
  private async previewData(runId: string, ruleSetId: string, db: OrmDatabase = this.db) {
    const run = await db.orm.public.PayrollRun.where({
      organizationId: this.organizationId,
      id: runId,
    }).first();
    const set = await db.orm.public.PayrollStatutoryRuleSet.where({
      organizationId: this.organizationId,
      id: ruleSetId,
    }).first();
    if (!run || !set || set.status === "DRAFT")
      throw new NotFoundException("Payroll or active statutory rule version not found");
    if (run.status !== "DRAFT")
      throw new ConflictException("Statutory calculations require a draft payroll");
    if (
      this.day(set.effectiveFrom) > this.day(run.periodEnd) ||
      (set.effectiveTo && this.day(set.effectiveTo) < this.day(run.periodStart))
    )
      throw new BadRequestException("The rule version does not cover this payroll period");
    const jurisdiction = await db.orm.public.PayrollTaxJurisdiction.where({
      organizationId: this.organizationId,
      id: set.jurisdictionId,
    }).first();
    if (!jurisdiction || jurisdiction.currency !== run.currency)
      throw new BadRequestException("Payroll currency does not match the jurisdiction");
    const brackets = await db.orm.public.PayrollTaxBracket.where({
      organizationId: this.organizationId,
      ruleSetId,
    }).all();
    const rules = await db.orm.public.PayrollStatutoryRule.where({
      organizationId: this.organizationId,
      ruleSetId,
    }).all();
    const entries = await db.orm.public.PayrollEntry.where({
      organizationId: this.organizationId,
      payrollRunId: runId,
    }).all();
    const results = [];
    for (const entry of entries) {
      const components = await db.orm.public.PayrollEntryComponent.where({
        organizationId: this.organizationId,
        payrollEntryId: entry.id,
      }).all();
      const nonStatutory = components.filter((row) => !row.statutoryRuleSetName);
      const missing = nonStatutory.filter(
        (row) => !row.statutoryClass && row.sourceSalaryComponentId,
      );
      if (missing.length) {
        results.push({
          entryId: entry.id,
          employeeName: entry.employeeName,
          missingClassifications: missing.map((row) => row.name),
        });
        continue;
      }
      const sum = (kind: string) =>
        nonStatutory
          .filter((row) => row.statutoryClass === kind)
          .reduce((total, row) => total + moneyToCents(row.amount), 0n);
      const taxableEarnings = moneyToCents(entry.baseAmount) + sum("TAXABLE_EARNING");
      const nonTaxable = sum("NON_TAXABLE_EARNING");
      const result = calculateStatutory({
        grossEarnings: entry.grossPay,
        taxableEarnings: centsToMoney(taxableEarnings),
        nonTaxableEarnings: centsToMoney(nonTaxable),
        preTaxDeductions: centsToMoney(sum("PRE_TAX_DEDUCTION")),
        postTaxDeductions: centsToMoney(sum("POST_TAX_DEDUCTION")),
        brackets,
        rules,
        periodsPerYear: set.periodsPerYear,
      });
      results.push({
        entryId: entry.id,
        employeeName: entry.employeeName,
        ...result,
        missingClassifications: [],
      });
    }
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ runVersion: run.version, ruleSetId, results }))
      .digest("hex");
    return { run, set, jurisdiction, results, previewHash: inputHash };
  }
  preview(runId: string, ruleSetId: string) {
    return this.previewData(runId, ruleSetId);
  }
  async apply(runId: string, input: ApplyStatutoryDto) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM payroll_runs WHERE id = ${runId} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const preview = await this.previewData(runId, input.ruleSetId, tx);
      if (
        preview.run.version !== input.expectedVersion ||
        preview.previewHash !== input.previewHash
      )
        throw new ConflictException("The statutory preview is stale; preview again");
      if (preview.results.some((row) => row.missingClassifications.length))
        throw new BadRequestException(
          "Classify all salary components before applying statutory calculations",
        );
      for (const row of preview.results) {
        if (!("grossEarnings" in row))
          throw new BadRequestException(
            "Classify all salary components before applying statutory calculations",
          );
        if (
          await tx.orm.public.PayrollStatutoryApplication.where({
            organizationId,
            payrollEntryId: row.entryId,
          }).first()
        )
          throw new ConflictException("Statutory calculations are already applied");
        const snapshot = JSON.stringify(row);
        const app = await tx.orm.public.PayrollStatutoryApplication.create({
          organizationId,
          payrollEntryId: row.entryId,
          ruleSetId: input.ruleSetId,
          appliedById: this.auth.userId,
          inputHash: input.previewHash,
          grossEarnings: payrollAmount(row.grossEarnings!),
          taxableEarnings: payrollAmount(row.taxableEarnings!),
          nonTaxableEarnings: payrollAmount(row.nonTaxableEarnings!),
          preTaxDeductions: payrollAmount(row.preTaxDeductions!),
          taxWithholding: payrollAmount(row.taxWithholding!),
          employeeContributions: payrollAmount(row.employeeContributions!),
          postTaxDeductions: payrollAmount(row.postTaxDeductions!),
          employerContributions: payrollAmount(row.employerContributions!),
          netPay: payrollAmount(row.netPay!),
          totalEmployerCost: payrollAmount(row.totalEmployerCost!),
          calculationSnapshot: snapshot,
        });
        const statutoryItems = [
          { name: "Income tax withholding", kind: "FLAT_WITHHOLDING", amount: row.taxWithholding! },
          ...row.items!.filter((item) => item.kind !== "FLAT_WITHHOLDING"),
        ].filter((item) => moneyToCents(item.amount) > 0n);
        for (const [index, item] of statutoryItems.entries())
          await tx.orm.public.PayrollEntryComponent.create({
            organizationId,
            payrollEntryId: row.entryId,
            name: item.name,
            type: item.kind === "EMPLOYER_CONTRIBUTION" ? "EMPLOYER_CONTRIBUTION" : "DEDUCTION",
            amount: payrollAmount(item.amount),
            statutoryRuleName: item.name,
            statutoryRuleSetName: `${preview.set.name} v${preview.set.version}`,
            statutoryJurisdiction: `${preview.jurisdiction.countryCode}${preview.jurisdiction.subdivisionCode ? `-${preview.jurisdiction.subdivisionCode}` : ""}`,
            calculationSnapshot: snapshot,
            isAdjustment: true,
            sortOrder: 20000 + index,
          });
        const entry = await tx.orm.public.PayrollEntry.where({
          organizationId,
          id: row.entryId,
        }).first();
        await tx.orm.public.PayrollEntry.where({ organizationId, id: row.entryId }).update({
          totalDeductions: payrollAmount(
            centsToMoney(moneyToCents(entry!.grossPay) - moneyToCents(row.netPay!)),
          ),
          netPay: payrollAmount(row.netPay!),
          version: entry!.version + 1,
        });
        void app;
      }
      const entries = await tx.orm.public.PayrollEntry.where({
        organizationId,
        payrollRunId: runId,
      }).all();
      const totalDeductions = entries.reduce(
        (sum, row) => sum + moneyToCents(row.totalDeductions),
        0n,
      );
      const totalNet = entries.reduce((sum, row) => sum + moneyToCents(row.netPay), 0n);
      const updated = await tx.orm.public.PayrollRun.where({
        organizationId,
        id: runId,
        version: input.expectedVersion,
      }).update({
        totalDeductions: payrollAmount(centsToMoney(totalDeductions)),
        totalNet: payrollAmount(centsToMoney(totalNet)),
        version: input.expectedVersion + 1,
      });
      await this.audit(
        "PAYROLL_RUN",
        runId,
        "STATUTORY_APPLIED",
        { ruleSetId: input.ruleSetId },
        tx,
      );
      return updated;
    });
  }
}
