import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, Queue, Worker } from "bullmq";
import { Temporal } from "temporal-polyfill";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import {
  bullConnection,
  bullPrefix,
  payrollWorkerConcurrency,
} from "../background-jobs/bullmq.config.js";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import { PayrollPayslipQueue } from "./payroll-payslip.queue.js";
import { PayrollPayslipStorageService } from "./payroll-payslip-storage.service.js";
import { PayrollService } from "./payroll.service.js";
import { PayrollNotificationsService } from "./payroll-notifications.service.js";
import { schedulePeriod, utcDate } from "./payroll-schedule.js";
import { PAYROLL_AUTOMATION_QUEUE, type PayrollAutomationJob } from "./payroll-automation.queue.js";

@Injectable()
export class PayrollAutomationProcessor {
  private readonly logger = new Logger(PayrollAutomationProcessor.name);
  private worker?: Worker<PayrollAutomationJob>;
  private queue?: Queue<PayrollAutomationJob>;
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly payslips: PayrollPayslipQueue,
    private readonly payslipStorage: PayrollPayslipStorageService,
    private readonly notifications: PayrollNotificationsService,
  ) {}
  async start() {
    this.queue = new Queue(PAYROLL_AUTOMATION_QUEUE, {
      connection: bullConnection(),
      prefix: bullPrefix(),
    });
    this.worker = new Worker(PAYROLL_AUTOMATION_QUEUE, (job) => this.process(job), {
      connection: bullConnection(),
      prefix: bullPrefix(),
      concurrency: payrollWorkerConcurrency(),
    });
    this.worker.on("failed", (job, error) =>
      this.logger.error(
        JSON.stringify({
          event: "payroll_automation_failed",
          jobId: job?.id,
          message: error.message,
        }),
      ),
    );
    await this.worker.waitUntilReady();
  }
  private process(job: Job<PayrollAutomationJob>) {
    return job.data.kind === "scan"
      ? this.scan()
      : this.generate(job.data.organizationId, job.data.occurrenceId);
  }
  private async scan() {
    const now = Temporal.Now.instant();
    const schedules = (
      await this.db.orm.public.PayrollSchedule.where({ status: "ACTIVE" })
        .orderBy((row) => row.nextRunAt.asc())
        .limit(100)
        .all()
    ).filter((schedule) => Temporal.Instant.compare(schedule.nextRunAt, now) <= 0);
    for (const schedule of schedules) {
      const period = schedulePeriod(
        schedule.nextPeriodStart,
        schedule.frequency,
        schedule.generationTime,
        schedule.timezone,
        schedule.periodAnchorDay,
      );
      let occurrence = await this.db.orm.public.PayrollScheduleOccurrence.where({
        organizationId: schedule.organizationId,
        scheduleId: schedule.id,
        periodStart: utcDate(period.start),
      }).first();
      if (!occurrence) {
        try {
          occurrence = await this.db.orm.public.PayrollScheduleOccurrence.create({
            organizationId: schedule.organizationId,
            scheduleId: schedule.id,
            periodStart: utcDate(period.start),
            periodEnd: utcDate(period.end),
            scheduledFor: period.scheduledFor,
            source: "SCHEDULED",
          });
        } catch {
          occurrence = await this.db.orm.public.PayrollScheduleOccurrence.where({
            organizationId: schedule.organizationId,
            scheduleId: schedule.id,
            periodStart: utcDate(period.start),
          }).first();
        }
      }
      const next = schedulePeriod(
        period.nextStart,
        schedule.frequency,
        schedule.generationTime,
        schedule.timezone,
        schedule.periodAnchorDay,
      );
      if (occurrence && ["PENDING", "FAILED"].includes(occurrence.status))
        await this.enqueue(occurrence.id, schedule.organizationId);
      await this.db.orm.public.PayrollSchedule.where({
        organizationId: schedule.organizationId,
        id: schedule.id,
        nextPeriodStart: schedule.nextPeriodStart,
      }).updateAll({ nextPeriodStart: utcDate(period.nextStart), nextRunAt: next.scheduledFor });
    }
  }
  private async enqueue(occurrenceId: string, organizationId: string) {
    await this.queue!.add(
      "generate-payroll-draft",
      { kind: "generate", occurrenceId, organizationId },
      { jobId: `payroll-occurrence-${occurrenceId}` },
    );
  }
  private async generate(organizationId: string, occurrenceId: string) {
    const occurrence = await this.db.orm.public.PayrollScheduleOccurrence.where({
      organizationId,
      id: occurrenceId,
    }).first();
    if (!occurrence || occurrence.status === "GENERATED") return;
    const schedule = await this.db.orm.public.PayrollSchedule.where({
      organizationId,
      id: occurrence.scheduleId,
    }).first();
    if (!schedule || schedule.status !== "ACTIVE") return;
    const [claimed] = await this.db.orm.public.PayrollScheduleOccurrence.where({
      organizationId,
      id: occurrenceId,
      status: occurrence.status,
    }).updateAll({
      status: "PROCESSING",
      attempts: occurrence.attempts + 1,
      failureCode: null,
      failureMessage: null,
    });
    if (!claimed) return;
    let runId = occurrence.payrollRunId;
    try {
      const request = {
        auth: { organizationId, userId: schedule.createdById, role: "OWNER" },
      } as AuthenticatedRequest;
      const payroll = new PayrollService(
        this.db,
        request,
        this.payslips,
        this.payslipStorage,
        this.notifications,
      );
      const eligibleEmployees = (
        await this.db.orm.public.Employee.where({ organizationId }).all()
      ).filter((employee) => ["ACTIVE", "ON_LEAVE"].includes(employee.status));
      if (!eligibleEmployees.length) {
        await this.db.orm.public.PayrollScheduleOccurrence.where({
          organizationId,
          id: occurrenceId,
        }).updateAll({
          status: "SKIPPED",
          failureCode: "NO_ELIGIBLE_EMPLOYEES",
          failureMessage: "No eligible employees were available for this period.",
        });
        return;
      }
      let run = runId
        ? await this.db.orm.public.PayrollRun.where({ organizationId, id: runId }).first()
        : null;
      if (!run)
        run =
          (
            await this.db.orm.public.PayrollRun.where({
              organizationId,
              payrollScheduleId: schedule.id,
            }).all()
          ).find(
            (candidate) =>
              candidate.periodStart.toString().slice(0, 10) ===
              occurrence.periodStart.toString().slice(0, 10),
          ) ?? null;
      if (!run) {
        const end = occurrence.periodEnd.toString().slice(0, 10);
        const paymentDate = Temporal.PlainDate.from(end).add({
          days: schedule.paymentOffsetDays ?? 0,
        });
        run = await payroll.createScheduledDraft(
          {
            name: `${schedule.name} · ${occurrence.periodStart.toString().slice(0, 10)}`,
            periodStart: occurrence.periodStart.toString().slice(0, 10),
            periodEnd: end,
            paymentDate: paymentDate.toString(),
          },
          schedule.id,
        );
        runId = run.id;
      }
      if (!occurrence.payrollRunId)
        await this.db.orm.public.PayrollScheduleOccurrence.where({
          organizationId,
          id: occurrenceId,
          payrollRunId: null,
        }).updateAll({ payrollRunId: run.id });
      if (run.employeeCount === 0) run = await payroll.calculate(run.id, run.version);
      await this.db.orm.public.PayrollScheduleOccurrence.where({
        organizationId,
        id: occurrenceId,
      }).updateAll({ status: "GENERATED", payrollRunId: run.id });
      await this.db.orm.public.PayrollSchedule.where({ organizationId, id: schedule.id }).updateAll(
        {
          lastSuccessfulAt: Temporal.Now.instant(),
        },
      );
      await this.notifications.notifyManagers(
        organizationId,
        "DRAFT_READY",
        `payroll-draft:${run.id}`,
        "Payroll draft ready",
        "An automated payroll draft is ready for review.",
      );
      return run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payroll generation failed";
      const conflict = message.toLowerCase().includes("overlap");
      await this.db.orm.public.PayrollScheduleOccurrence.where({
        organizationId,
        id: occurrenceId,
      }).updateAll({
        status: conflict ? "CONFLICT" : "FAILED",
        failureCode: conflict ? "OVERLAPPING_PAYROLL" : "GENERATION_FAILED",
        failureMessage: conflict
          ? "An existing payroll run overlaps this scheduled period."
          : "Payroll draft generation failed. Retry after reviewing employee salary setup.",
      });
      await this.notifications.notifyManagers(
        organizationId,
        "AUTOMATION_FAILED",
        `payroll-failed:${occurrenceId}:${occurrence.attempts + 1}`,
        "Payroll automation needs attention",
        conflict
          ? "A scheduled payroll conflicts with an existing pay run."
          : "A scheduled payroll draft could not be prepared.",
      );
      if (conflict) return;
      throw error;
    }
  }
  async close() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
