import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, Queue, Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../../infrastructure/database/database.module.js";
import type { Database } from "../../infrastructure/database/client.js";
import {
  bullConnection,
  bullPrefix,
  recurringInvoiceWorkerConcurrency,
} from "../../infrastructure/background-jobs/bullmq.config.js";
import { calculateInvoice } from "../invoices/utils/invoice-calculations.js";
import { InvoicesService } from "../invoices/invoices.service.js";
import { InvoicePdfService } from "../invoices/pdf/invoice-pdf.service.js";
import { InvoicePdfStorageService } from "../invoices/pdf/invoice-pdf-storage.service.js";
import type { AuthenticatedRequest } from "../../common/types/auth.types.js";
import { nextOccurrence } from "./recurring-schedule.js";
import { RECURRING_INVOICE_QUEUE, type RecurringInvoiceJob } from "./recurring-invoice.queue.js";

const CATCH_UP_LIMIT = 12;

@Injectable()
export class RecurringInvoiceProcessor {
  private readonly logger = new Logger(RecurringInvoiceProcessor.name);
  private worker?: Worker<RecurringInvoiceJob>;
  private queue?: Queue<RecurringInvoiceJob>;
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly pdf: InvoicePdfService,
    private readonly pdfStorage: InvoicePdfStorageService,
  ) {}
  async start() {
    this.queue = new Queue(RECURRING_INVOICE_QUEUE, {
      connection: bullConnection(),
      prefix: bullPrefix(),
    });
    this.worker = new Worker(RECURRING_INVOICE_QUEUE, (job) => this.process(job), {
      connection: bullConnection(),
      prefix: bullPrefix(),
      concurrency: recurringInvoiceWorkerConcurrency(),
    });
    this.worker.on("failed", (job, error) =>
      this.logger.error(
        JSON.stringify({
          event: "recurring_invoice_failed",
          jobId: job?.id,
          message: error.message,
        }),
      ),
    );
    await this.worker.waitUntilReady();
  }
  private async process(job: Job<RecurringInvoiceJob>) {
    if (job.data.kind === "scan") return this.scan();
    return this.generate(job.data.organizationId, job.data.occurrenceId);
  }
  private async scan() {
    const now = Temporal.Now.instant();
    const schedules = (
      await this.db.orm.public.RecurringInvoiceSchedule.where({ status: "ACTIVE" })
        .orderBy((row) => row.nextRunAt.asc())
        .limit(100)
        .all()
    ).filter((schedule) => Temporal.Instant.compare(schedule.nextRunAt, now) <= 0);
    for (const schedule of schedules) {
      let cursor = schedule.nextRunAt;
      for (
        let count = 0;
        count < CATCH_UP_LIMIT && Temporal.Instant.compare(cursor, now) <= 0;
        count++
      ) {
        if (schedule.endDate && Temporal.Instant.compare(cursor, schedule.endDate) > 0) {
          await this.db.orm.public.RecurringInvoiceSchedule.where({
            id: schedule.id,
            organizationId: schedule.organizationId,
            status: "ACTIVE",
          }).updateAll({ status: "COMPLETED" });
          break;
        }
        let occurrence = await this.db.orm.public.RecurringInvoiceOccurrence.where({
          organizationId: schedule.organizationId,
          scheduleId: schedule.id,
          scheduledFor: cursor,
        }).first();
        if (!occurrence)
          occurrence = await this.db.orm.public.RecurringInvoiceOccurrence.create({
            organizationId: schedule.organizationId,
            scheduleId: schedule.id,
            scheduledFor: cursor,
          });
        if (occurrence.status === "PENDING")
          await this.queue!.add(
            "generate-recurring-invoice",
            {
              kind: "occurrence",
              occurrenceId: occurrence.id,
              organizationId: schedule.organizationId,
            },
            { jobId: `occurrence-${occurrence.id}` },
          ).catch(() => undefined);
        const next = nextOccurrence(
          cursor,
          schedule.startDate,
          schedule.frequency,
          schedule.interval,
        );
        await this.db.orm.public.RecurringInvoiceSchedule.where({
          id: schedule.id,
          organizationId: schedule.organizationId,
          status: "ACTIVE",
          nextRunAt: cursor,
        }).updateAll({ lastRunAt: cursor, nextRunAt: next });
        cursor = next;
      }
    }
  }
  private async generate(organizationId: string, occurrenceId: string) {
    const occurrence = await this.db.orm.public.RecurringInvoiceOccurrence.where({
      id: occurrenceId,
      organizationId,
    }).first();
    if (!occurrence || occurrence.status === "GENERATED") return;
    const schedule = await this.db.orm.public.RecurringInvoiceSchedule.where({
      id: occurrence.scheduleId,
      organizationId,
    }).first();
    if (!schedule || schedule.status !== "ACTIVE") return;
    const existing = occurrence.invoiceId
      ? await this.db.orm.public.Invoice.where({ id: occurrence.invoiceId, organizationId }).first()
      : null;
    if (existing) {
      if (schedule.autoIssue && existing.status === "DRAFT") {
        const request = {
          auth: { organizationId, userId: schedule.createdById, role: "OWNER" },
        } as AuthenticatedRequest;
        await new InvoicesService(this.db, request, this.pdf, this.pdfStorage).issueInvoice(
          existing.id,
          existing.version,
        );
      }
      await this.db.orm.public.RecurringInvoiceOccurrence.where({
        id: occurrenceId,
        organizationId,
      }).updateAll({ status: "GENERATED", failureCode: null });
      return;
    }
    const [claimed] = await this.db.orm.public.RecurringInvoiceOccurrence.where({
      id: occurrenceId,
      organizationId,
      status: occurrence.status,
    }).updateAll({ status: "PROCESSING", attempts: occurrence.attempts + 1, failureCode: null });
    if (!claimed) return;
    try {
      const items = await this.db.orm.public.RecurringInvoiceItem.where({
        organizationId,
        scheduleId: schedule.id,
      })
        .orderBy((row) => row.position.asc())
        .all();
      const calculated = calculateInvoice(items);
      const issueDate = occurrence.scheduledFor;
      const dueDate = Temporal.Instant.from(
        `${Temporal.PlainDate.from(issueDate.toString().slice(0, 10)).add({ days: schedule.dueDateOffsetDays }).toString()}T00:00:00Z`,
      );
      const invoice = await this.db.transaction(async (tx) => {
        const created = await tx.orm.public.Invoice.create({
          organizationId,
          clientId: schedule.clientId,
          invoiceNumber: `INV-${randomUUID()}`,
          status: "DRAFT",
          issueDate,
          dueDate,
          subtotal: calculated.subtotal,
          tax: calculated.tax,
          total: calculated.total,
          notes: schedule.description ?? undefined,
        });
        for (const [position, item] of calculated.items.entries())
          await tx.orm.public.InvoiceItem.create({
            organizationId,
            invoiceId: created.id,
            ...item,
            position,
          });
        const [linked] = await tx.orm.public.RecurringInvoiceOccurrence.where({
          id: occurrenceId,
          organizationId,
          invoiceId: null,
        }).updateAll({ invoiceId: created.id });
        if (!linked) throw new Error("OCCURRENCE_ALREADY_LINKED");
        return created;
      });
      if (schedule.autoIssue) {
        const request = {
          auth: { organizationId, userId: schedule.createdById, role: "OWNER" },
        } as AuthenticatedRequest;
        await new InvoicesService(this.db, request, this.pdf, this.pdfStorage).issueInvoice(
          invoice.id,
          invoice.version,
        );
        await this.db.orm.public.RecurringScheduleEvent.create({
          organizationId,
          scheduleId: schedule.id,
          action: "AUTO_ISSUED",
          details: invoice.id,
        });
      }
      await this.db.orm.public.RecurringInvoiceOccurrence.where({
        id: occurrenceId,
        organizationId,
      }).updateAll({ status: "GENERATED", failureCode: null });
      await this.db.orm.public.RecurringScheduleEvent.create({
        organizationId,
        scheduleId: schedule.id,
        action: "OCCURRENCE_GENERATED",
        details: invoice.id,
      });
    } catch (error) {
      await this.db.orm.public.RecurringInvoiceOccurrence.where({
        id: occurrenceId,
        organizationId,
      }).updateAll({ status: "FAILED", failureCode: "GENERATION_FAILED" });
      await this.db.orm.public.RecurringScheduleEvent.create({
        organizationId,
        scheduleId: schedule.id,
        action: "GENERATION_FAILED",
        details: occurrenceId,
      });
      throw error;
    }
  }
  async close() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
