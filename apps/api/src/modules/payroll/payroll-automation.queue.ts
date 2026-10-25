import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { bullConnection, bullPrefix } from "../../infrastructure/background-jobs/bullmq.config.js";

export const PAYROLL_AUTOMATION_QUEUE = "payroll-automation";
export type PayrollAutomationJob =
  { kind: "scan" } | { kind: "generate"; organizationId: string; occurrenceId: string };

@Injectable()
export class PayrollAutomationQueue implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PayrollAutomationQueue.name);
  readonly queue = new Queue<PayrollAutomationJob>(PAYROLL_AUTOMATION_QUEUE, {
    connection: bullConnection(),
    prefix: bullPrefix(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 1000 },
    },
  });
  constructor() {
    this.queue.on("error", (error) =>
      this.logger.error(`Payroll automation queue error: ${error.message}`),
    );
  }
  async onApplicationBootstrap() {
    await this.queue.waitUntilReady();
    await this.queue.upsertJobScheduler(
      "payroll-automation-scan",
      { every: 60_000 },
      { name: "scan-payroll-schedules", data: { kind: "scan" } },
    );
  }
  async enqueue(occurrenceId: string, organizationId: string) {
    try {
      const jobId = `payroll-occurrence-${occurrenceId}`;
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (["failed", "completed"].includes(state)) await existing.remove();
        else return;
      }
      await this.queue.add(
        "generate-payroll-draft",
        { kind: "generate", occurrenceId, organizationId },
        { jobId },
      );
    } catch (error) {
      throw new ServiceUnavailableException("Payroll automation queue is unavailable", {
        cause: error,
      });
    }
  }
  async onApplicationShutdown() {
    await this.queue.close();
  }
}
