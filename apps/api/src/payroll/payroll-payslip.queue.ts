import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { bullConnection, bullPrefix } from "../background-jobs/bullmq.config.js";

export const PAYROLL_PAYSLIP_QUEUE = "payroll-payslips";
export type PayrollPayslipJob = {
  organizationId: string;
  payrollRunId: string;
  payrollEntryId: string;
  actorId: string;
};

@Injectable()
export class PayrollPayslipQueue implements OnApplicationShutdown {
  private readonly logger = new Logger(PayrollPayslipQueue.name);
  readonly queue = new Queue<PayrollPayslipJob>(PAYROLL_PAYSLIP_QUEUE, {
    connection: bullConnection(),
    prefix: bullPrefix(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 86400, count: 2000 },
      removeOnFail: { age: 604800, count: 2000 },
    },
  });
  constructor() {
    this.queue.on("error", (error) => this.logger.error(`Payslip queue error: ${error.message}`));
  }
  async enqueue(
    organizationId: string,
    payrollRunId: string,
    payrollEntryId: string,
    actorId: string,
  ) {
    try {
      const jobId = `payslip-${payrollEntryId}`;
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (["completed", "failed"].includes(state)) await existing.remove();
        else return;
      }
      await this.queue.add(
        "generate-payslip",
        { organizationId, payrollRunId, payrollEntryId, actorId },
        { jobId },
      );
    } catch (error) {
      throw new ServiceUnavailableException("Payslip queue is unavailable", { cause: error });
    }
  }
  async onApplicationShutdown() {
    await this.queue.close();
  }
}
