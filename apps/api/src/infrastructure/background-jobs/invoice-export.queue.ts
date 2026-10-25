import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { bullConnection, bullPrefix, INVOICE_EXPORT_QUEUE } from "./bullmq.config.js";

export type InvoiceExportJob = {
  exportId: string;
  organizationId: string;
};

@Injectable()
export class InvoiceExportQueue implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(InvoiceExportQueue.name);
  readonly queue = new Queue<InvoiceExportJob>(INVOICE_EXPORT_QUEUE, {
    connection: bullConnection(),
    prefix: bullPrefix(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
    },
  });

  constructor() {
    this.queue.on("error", (error) =>
      this.logger.error(`Invoice export queue error: ${error.message}`),
    );
  }

  async onApplicationBootstrap() {
    await this.queue.waitUntilReady();
    await this.queue.upsertJobScheduler(
      "invoice-export-cleanup-hourly",
      { every: 60 * 60 * 1000 },
      {
        name: "cleanup-invoice-exports",
        data: { exportId: "cleanup", organizationId: "system" },
      },
    );
  }

  async enqueue(data: InvoiceExportJob) {
    try {
      const existing = await this.queue.getJob(data.exportId);
      if (existing) {
        const state = await existing.getState();
        if (["failed", "completed"].includes(state)) await existing.remove();
        else return;
      }
      await this.queue.add("create-invoice-export", data, {
        jobId: data.exportId,
      });
    } catch (error) {
      throw new ServiceUnavailableException("Invoice export queue is unavailable", {
        cause: error,
      });
    }
  }

  async onApplicationShutdown() {
    await this.queue.close();
  }
}
