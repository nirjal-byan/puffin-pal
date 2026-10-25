import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, Worker } from "bullmq";
import { DATABASE } from "../../infrastructure/database/database.module.js";
import type { Database } from "../../infrastructure/database/client.js";
import {
  bullConnection,
  bullPrefix,
  payrollWorkerConcurrency,
} from "../../infrastructure/background-jobs/bullmq.config.js";
import { PayrollPdfService } from "./payroll-pdf.service.js";
import { PayrollPayslipStorageService } from "./payroll-payslip-storage.service.js";
import { PAYROLL_PAYSLIP_QUEUE, type PayrollPayslipJob } from "./payroll-payslip.queue.js";

@Injectable()
export class PayrollPayslipProcessor {
  private readonly logger = new Logger(PayrollPayslipProcessor.name);
  private worker?: Worker<PayrollPayslipJob>;
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly pdf: PayrollPdfService,
    private readonly storage: PayrollPayslipStorageService,
  ) {}
  async start() {
    this.worker = new Worker(PAYROLL_PAYSLIP_QUEUE, (job) => this.process(job), {
      connection: bullConnection(),
      prefix: bullPrefix(),
      concurrency: payrollWorkerConcurrency(),
    });
    this.worker.on("failed", (job, error) =>
      this.logger.error(
        JSON.stringify({ event: "payslip_failed", jobId: job?.id, message: error.message }),
      ),
    );
    await this.worker.waitUntilReady();
  }
  private day(value: { toString(): string }) {
    return value.toString().slice(0, 10);
  }
  private async process(job: Job<PayrollPayslipJob>) {
    const { organizationId, payrollRunId, payrollEntryId, actorId } = job.data;
    const entry = await this.db.orm.public.PayrollEntry.where({
      organizationId,
      id: payrollEntryId,
      payrollRunId,
    }).first();
    const run = await this.db.orm.public.PayrollRun.where({
      organizationId,
      id: payrollRunId,
    }).first();
    if (!entry || !run || run.status !== "FINALIZED") return;
    if (entry.payslipStatus === "COMPLETED" && entry.payslipKey) return;
    await this.db.orm.public.PayrollEntry.where({ organizationId, id: payrollEntryId }).update({
      payslipStatus: "PROCESSING",
      payslipFailureCode: null,
    });
    let key: string | undefined;
    try {
      const components = await this.db.orm.public.PayrollEntryComponent.where({
        organizationId,
        payrollEntryId,
      })
        .orderBy((row) => row.sortOrder.asc())
        .all();
      const buffer = await this.pdf.render({
        runName: run.name,
        organizationName: run.organizationName,
        periodStart: this.day(run.periodStart),
        periodEnd: this.day(run.periodEnd),
        paymentDate: this.day(run.paymentDate),
        currency: run.currency,
        employeeName: entry.employeeName,
        employeeCode: entry.employeeCode,
        departmentName: entry.departmentName,
        jobTitle: entry.jobTitle,
        baseAmount: entry.baseAmount,
        grossPay: entry.grossPay,
        totalDeductions: entry.totalDeductions,
        netPay: entry.netPay,
        components,
      });
      key = this.storage.createKey(organizationId, payrollRunId, payrollEntryId);
      await this.storage.put(key, buffer, organizationId, payrollRunId, payrollEntryId);
      const [updated] = await this.db.orm.public.PayrollEntry.where({
        organizationId,
        id: payrollEntryId,
        payslipKey: null,
      }).updateAll({ payslipKey: key, payslipStatus: "COMPLETED", payslipFailureCode: null });
      if (!updated) await this.storage.delete(key).catch(() => undefined);
      else
        await this.db.orm.public.PayrollAuditEvent.create({
          organizationId,
          payrollRunId,
          payrollEntryId,
          actorId,
          action: "PAYSLIP_GENERATED",
        });
    } catch (error) {
      if (key) await this.storage.delete(key).catch(() => undefined);
      await this.db.orm.public.PayrollEntry.where({
        organizationId,
        id: payrollEntryId,
        payslipKey: null,
      }).updateAll({ payslipStatus: "FAILED", payslipFailureCode: "GENERATION_FAILED" });
      await this.db.orm.public.PayrollAuditEvent.create({
        organizationId,
        payrollRunId,
        payrollEntryId,
        actorId,
        action: "PAYSLIP_FAILED",
        details: "GENERATION_FAILED",
      }).catch(() => undefined);
      throw error;
    }
  }
  async close() {
    await this.worker?.close();
  }
}
