import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { bullConnection, bullPrefix } from "../../infrastructure/background-jobs/bullmq.config.js";

export const RECURRING_INVOICE_QUEUE = "recurring-invoices";
export type RecurringInvoiceJob =
  { kind: "scan" } | { kind: "occurrence"; occurrenceId: string; organizationId: string };

@Injectable()
export class RecurringInvoiceQueue implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RecurringInvoiceQueue.name);
  readonly queue = new Queue<RecurringInvoiceJob>(RECURRING_INVOICE_QUEUE, {
    connection: bullConnection(),
    prefix: bullPrefix(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 1000 },
    },
  });
  constructor() {
    this.queue.on("error", (error) =>
      this.logger.error(`Recurring invoice queue error: ${error.message}`),
    );
  }
  async onApplicationBootstrap() {
    await this.queue.waitUntilReady();
    await this.queue.upsertJobScheduler(
      "recurring-invoice-scan",
      { every: 60_000 },
      { name: "scan-recurring-invoices", data: { kind: "scan" } },
    );
  }
  async enqueueOccurrence(occurrenceId: string, organizationId: string) {
    try {
      const jobId = `occurrence-${occurrenceId}`;
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (["failed", "completed"].includes(state)) await existing.remove();
        else return;
      }
      await this.queue.add(
        "generate-recurring-invoice",
        { kind: "occurrence", occurrenceId, organizationId },
        { jobId },
      );
    } catch (error) {
      throw new ServiceUnavailableException("Recurring invoice queue is unavailable", {
        cause: error,
      });
    }
  }
  async onApplicationShutdown() {
    await this.queue.close();
  }
}
