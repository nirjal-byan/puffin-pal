import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Numeric } from "@prisma/orm-postgres/target/codec-types";
import { DATABASE } from "../../infrastructure/database/database.module.js";
import type { Database } from "../../infrastructure/database/client.js";
import type { AuthenticatedRequest } from "../../common/types/auth.types.js";
import type {
  BankAccountDto,
  BankImportDto,
  BankingPageDto,
  CreatePaymentBatchDto,
  PaymentBatchItemDto,
  ReconcileDto,
  ReverseReconciliationDto,
} from "./banking.dto.js";
import { csvSourceHash, parseBankCsv } from "./banking-csv.js";

type OrmDatabase = Pick<Database, "orm">;

function instant(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}
function day(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}
function cents(value: unknown) {
  const normalized = String(value);
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new BadRequestException("Invalid money value");
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = (negative ? normalized.slice(1) : normalized).split(".");
  const result = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -result : result;
}
function money(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}` as Numeric<14, 2>;
}
const bankAmount = (value: string) => value as Numeric<14, 2>;
function matchScore(
  transactionDate: Date,
  paymentDate: Date,
  bankReference: string | null,
  paymentReference: string | null,
) {
  const days = Math.abs(transactionDate.getTime() - paymentDate.getTime()) / 86_400_000;
  const referenceMatches =
    bankReference && paymentReference
      ? bankReference.trim().toLowerCase() === paymentReference.trim().toLowerCase()
      : false;
  return (referenceMatches ? 100 : 0) + Math.max(0, 30 - Math.min(days, 30));
}

@Injectable({ scope: Scope.REQUEST })
export class BankingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}
  private get tenant() {
    if (!this.request.auth) throw new Error("Authenticated tenant is required");
    return this.request.auth;
  }
  private audit(
    entityType: string,
    entityId: string,
    action: string,
    details?: unknown,
    tx: OrmDatabase = this.db,
  ) {
    return tx.orm.public.BankingAuditEvent.create({
      organizationId: this.tenant.organizationId,
      actorId: this.tenant.userId,
      entityType,
      entityId,
      action,
      details: details === undefined ? null : JSON.stringify(details),
    });
  }

  listAccounts() {
    return this.db.orm.public.BankAccount.where({ organizationId: this.tenant.organizationId })
      .orderBy([(row) => row.displayName.asc()])
      .all();
  }
  async createAccount(input: BankAccountDto) {
    const organizationId = this.tenant.organizationId;
    return this.db.transaction(async (tx) => {
      if (input.isDefault)
        await tx.orm.public.BankAccount.where({ organizationId }).updateAll({ isDefault: false });
      const account = await tx.orm.public.BankAccount.create({
        organizationId,
        createdById: this.tenant.userId,
        displayName: input.displayName.trim(),
        bankName: input.bankName.trim(),
        accountHolder: input.accountHolder.trim(),
        maskedIdentifier: input.maskedIdentifier.trim(),
        currency: input.currency,
        countryCode: input.countryCode.toUpperCase(),
        isActive: input.isActive,
        isDefault: input.isDefault,
      });
      await this.audit("BANK_ACCOUNT", account.id, "CREATED", undefined, tx);
      return account;
    });
  }
  async updateAccount(id: string, input: BankAccountDto) {
    const organizationId = this.tenant.organizationId;
    return this.db.transaction(async (tx) => {
      const existing = await tx.orm.public.BankAccount.where({ organizationId, id }).first();
      if (!existing) throw new NotFoundException("Bank account not found");
      if (!input.expectedVersion || input.expectedVersion !== existing.version)
        throw new ConflictException("Bank account changed. Reload and try again.");
      if (input.isDefault)
        await tx.orm.public.BankAccount.where({ organizationId }).updateAll({ isDefault: false });
      const [updated] = await tx.orm.public.BankAccount.where({
        organizationId,
        id,
        version: input.expectedVersion,
      }).updateAll({
        displayName: input.displayName.trim(),
        bankName: input.bankName.trim(),
        accountHolder: input.accountHolder.trim(),
        maskedIdentifier: input.maskedIdentifier.trim(),
        currency: input.currency,
        countryCode: input.countryCode.toUpperCase(),
        isActive: input.isActive,
        isDefault: input.isDefault,
        version: input.expectedVersion + 1,
      });
      if (!updated) throw new ConflictException("Bank account changed. Reload and try again.");
      await this.audit("BANK_ACCOUNT", id, "UPDATED", undefined, tx);
      return updated;
    });
  }

  async previewImport(input: BankImportDto) {
    const account = await this.db.orm.public.BankAccount.where({
      organizationId: this.tenant.organizationId,
      id: input.bankAccountId,
      isActive: true,
    }).first();
    if (!account) throw new NotFoundException("Active bank account not found");
    let rows;
    try {
      rows = parseBankCsv(input.csv, input.mapping, account.currency);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid CSV");
    }
    const existing = await this.db.orm.public.BankTransaction.where({
      organizationId: this.tenant.organizationId,
      bankAccountId: account.id,
    })
      .select("fingerprint")
      .all();
    const fingerprints = new Set(existing.map((row) => row.fingerprint));
    return {
      account: { id: account.id, displayName: account.displayName, currency: account.currency },
      rowCount: rows.length,
      duplicateCount: rows.filter((row) => fingerprints.has(row.fingerprint)).length,
      rows: rows
        .slice(0, 100)
        .map((row) => ({ ...row, duplicate: fingerprints.has(row.fingerprint) })),
    };
  }

  async confirmImport(input: BankImportDto) {
    const organizationId = this.tenant.organizationId;
    const preview = await this.previewImport(input);
    const rows = parseBankCsv(input.csv, input.mapping, preview.account.currency);
    const sourceHash = csvSourceHash(input.csv);
    return this.db.transaction(async (tx) => {
      const prior = await tx.orm.public.BankTransactionImport.where({
        organizationId,
        bankAccountId: input.bankAccountId,
        sourceHash,
      }).first();
      if (prior)
        throw new ConflictException("This CSV file was already imported into this account");
      const existing = await tx.orm.public.BankTransaction.where({
        organizationId,
        bankAccountId: input.bankAccountId,
      })
        .select("fingerprint")
        .all();
      const fingerprints = new Set(existing.map((row) => row.fingerprint));
      const fresh = rows.filter((row) => !fingerprints.has(row.fingerprint));
      const batch = await tx.orm.public.BankTransactionImport.create({
        organizationId,
        bankAccountId: input.bankAccountId,
        uploadedById: this.tenant.userId,
        fileName: input.fileName.replace(/[\r\n]/g, " ").slice(0, 160),
        sourceHash,
        status: fresh.length === rows.length ? "IMPORTED" : "PARTIALLY_IMPORTED",
        rowCount: rows.length,
        importedCount: fresh.length,
        duplicateCount: rows.length - fresh.length,
      });
      for (const row of fresh)
        await tx.orm.public.BankTransaction.create({
          organizationId,
          bankAccountId: input.bankAccountId,
          importId: batch.id,
          transactionDate: instant(row.date),
          amount: bankAmount(row.amount),
          currency: row.currency,
          direction: row.direction,
          description: row.description,
          reference: row.reference,
          fingerprint: row.fingerprint,
        });
      await this.audit(
        "BANK_IMPORT",
        batch.id,
        "IMPORTED",
        { imported: fresh.length, duplicates: rows.length - fresh.length },
        tx,
      );
      return batch;
    });
  }

  listImports(query: BankingPageDto) {
    return this.db.orm.public.BankTransactionImport.where({
      organizationId: this.tenant.organizationId,
    })
      .orderBy((row) => row.createdAt.desc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }

  async listTransactions(query: BankingPageDto) {
    let rows = await this.db.orm.public.BankTransaction.where({
      organizationId: this.tenant.organizationId,
    })
      .orderBy([(row) => row.transactionDate.desc(), (row) => row.id.desc()])
      .all();
    if (query.bankAccountId) rows = rows.filter((row) => row.bankAccountId === query.bankAccountId);
    if (query.search) {
      const search = query.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.description.toLowerCase().includes(search) ||
          row.reference?.toLowerCase().includes(search),
      );
    }
    const reconciliations = await this.db.orm.public.BankReconciliation.where({
      organizationId: this.tenant.organizationId,
    }).all();
    const byTransaction = new Map(reconciliations.map((row) => [row.bankTransactionId, row]));
    const enriched = rows.map((row) => ({
      ...row,
      reconciliation: byTransaction.get(row.id) ?? null,
    }));
    const filtered =
      query.status === "MATCHED"
        ? enriched.filter((row) => row.reconciliation)
        : query.status === "UNMATCHED"
          ? enriched.filter((row) => !row.reconciliation)
          : enriched;
    return filtered.slice(query.offset, query.offset + query.limit);
  }

  async suggestions(transactionId: string) {
    const organizationId = this.tenant.organizationId;
    const transaction = await this.db.orm.public.BankTransaction.where({
      organizationId,
      id: transactionId,
    }).first();
    if (!transaction) throw new NotFoundException("Bank transaction not found");
    if (
      await this.db.orm.public.BankReconciliation.where({
        organizationId,
        bankTransactionId: transactionId,
      }).first()
    )
      return [];
    const organization = await this.db.orm.public.Organization.where({
      id: organizationId,
    }).first();
    if (transaction.direction === "CREDIT") {
      const [payments, invoices, reconciled] = await Promise.all([
        this.db.orm.public.Payment.where({ organizationId }).all(),
        this.db.orm.public.Invoice.where({ organizationId }).all(),
        this.db.orm.public.BankReconciliation.where({ organizationId }).all(),
      ]);
      const used = new Set(reconciled.map((row) => row.invoicePaymentId).filter(Boolean));
      const invoiceById = new Map(invoices.map((row) => [row.id, row]));
      return payments
        .filter((payment) => {
          const invoice = invoiceById.get(payment.invoiceId);
          return (
            !used.has(payment.id) &&
            cents(payment.amount) === cents(transaction.amount) &&
            (invoice?.currency ?? organization?.currency) === transaction.currency
          );
        })
        .map((payment) => ({
          targetType: "INVOICE_PAYMENT",
          targetId: payment.id,
          amount: String(payment.amount),
          date: day(payment.paymentDate),
          reference: payment.reference,
          label: invoiceById.get(payment.invoiceId)?.invoiceNumber ?? "Invoice payment",
          score: matchScore(
            transaction.transactionDate,
            payment.paymentDate,
            transaction.reference,
            payment.reference,
          ),
        }))
        .sort((left, right) => right.score - left.score);
    }
    const [payments, entries, reconciled] = await Promise.all([
      this.db.orm.public.PayrollPayment.where({ organizationId }).all(),
      this.db.orm.public.PayrollEntry.where({ organizationId }).all(),
      this.db.orm.public.BankReconciliation.where({ organizationId }).all(),
    ]);
    const used = new Set(reconciled.map((row) => row.payrollPaymentId).filter(Boolean));
    const entryById = new Map(entries.map((row) => [row.id, row]));
    return payments
      .filter(
        (payment) => !used.has(payment.id) && cents(payment.amount) === cents(transaction.amount),
      )
      .map((payment) => ({
        targetType: "PAYROLL_PAYMENT",
        targetId: payment.id,
        amount: String(payment.amount),
        date: day(payment.paymentDate),
        reference: payment.reference,
        label: entryById.get(payment.payrollEntryId)?.employeeName ?? "Payroll payment",
        score: matchScore(
          transaction.transactionDate,
          payment.paymentDate,
          transaction.reference,
          payment.reference,
        ),
      }))
      .sort((left, right) => right.score - left.score);
  }

  async reconcile(transactionId: string, input: ReconcileDto) {
    const organizationId = this.tenant.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM bank_transactions WHERE id = ${transactionId} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const transaction = await tx.orm.public.BankTransaction.where({
        organizationId,
        id: transactionId,
      }).first();
      if (!transaction) throw new NotFoundException("Bank transaction not found");
      if (
        await tx.orm.public.BankReconciliation.where({
          organizationId,
          bankTransactionId: transactionId,
        }).first()
      )
        throw new ConflictException("Bank transaction is already reconciled");
      let payment: {
        id: string;
        amount: unknown;
        paymentDate: Date;
        reference: string | null;
      } | null;
      if (input.targetType === "INVOICE_PAYMENT") {
        const row = await tx.orm.public.Payment.where({
          organizationId,
          id: input.targetId,
        }).first();
        payment = row
          ? {
              id: row.id,
              amount: row.amount,
              paymentDate: row.paymentDate,
              reference: row.reference,
            }
          : null;
        if (transaction.direction !== "CREDIT")
          throw new BadRequestException("Invoice payments require a credit transaction");
        if (row) {
          const invoice = await tx.orm.public.Invoice.where({
            organizationId,
            id: row.invoiceId,
          }).first();
          if (invoice?.currency !== transaction.currency)
            throw new BadRequestException("Payment and bank currencies must match");
        }
      } else {
        const row = await tx.orm.public.PayrollPayment.where({
          organizationId,
          id: input.targetId,
        }).first();
        payment = row
          ? {
              id: row.id,
              amount: row.amount,
              paymentDate: row.paymentDate,
              reference: row.reference,
            }
          : null;
        if (transaction.direction !== "DEBIT")
          throw new BadRequestException("Payroll payments require a debit transaction");
        if (row) {
          const entry = await tx.orm.public.PayrollEntry.where({
            organizationId,
            id: row.payrollEntryId,
          }).first();
          const run = entry
            ? await tx.orm.public.PayrollRun.where({
                organizationId,
                id: entry.payrollRunId,
              }).first()
            : null;
          if (run?.currency !== transaction.currency)
            throw new BadRequestException("Payment and bank currencies must match");
        }
      }
      if (!payment) throw new NotFoundException("Payment record not found");
      if (cents(payment.amount) !== cents(transaction.amount))
        throw new BadRequestException("Payment and bank amounts must match exactly");
      const reconciliation = await tx.orm.public.BankReconciliation.create({
        organizationId,
        bankTransactionId: transactionId,
        targetType: input.targetType,
        invoicePaymentId: input.targetType === "INVOICE_PAYMENT" ? input.targetId : null,
        payrollPaymentId: input.targetType === "PAYROLL_PAYMENT" ? input.targetId : null,
        reconciledById: this.tenant.userId,
      });
      await this.audit(
        "RECONCILIATION",
        reconciliation.id,
        "CONFIRMED",
        { transactionId, targetType: input.targetType, targetId: input.targetId },
        tx,
      );
      return reconciliation;
    });
  }

  async reverseReconciliation(id: string, input: ReverseReconciliationDto) {
    const organizationId = this.tenant.organizationId;
    return this.db.transaction(async (tx) => {
      const reconciliation = await tx.orm.public.BankReconciliation.where({
        organizationId,
        id,
      }).first();
      if (!reconciliation) throw new NotFoundException("Reconciliation not found");
      if (reconciliation.version !== input.expectedVersion)
        throw new ConflictException("Reconciliation changed. Reload and try again.");
      await tx.orm.public.BankReconciliation.where({
        organizationId,
        id,
        version: input.expectedVersion,
      }).delete();
      await this.audit(
        "RECONCILIATION",
        id,
        "REVERSED",
        { reason: input.reason.trim(), transactionId: reconciliation.bankTransactionId },
        tx,
      );
      return { message: "Reconciliation reversed" };
    });
  }

  async createPaymentBatch(input: CreatePaymentBatchDto) {
    const organizationId = this.tenant.organizationId;
    return this.db.transaction(async (tx) => {
      const run = await tx.orm.public.PayrollRun.where({
        organizationId,
        id: input.payrollRunId,
      }).first();
      if (!run || run.status !== "FINALIZED")
        throw new ConflictException("Payment batches require finalized payroll");
      if (input.bankAccountId) {
        const account = await tx.orm.public.BankAccount.where({
          organizationId,
          id: input.bankAccountId,
          isActive: true,
        }).first();
        if (!account) throw new NotFoundException("Active bank account not found");
        if (account.currency !== run.currency)
          throw new BadRequestException("Bank account and payroll currencies must match");
      }
      if (!input.entryIds.length)
        throw new BadRequestException("Select at least one unpaid payroll entry");
      const entries = (
        await tx.orm.public.PayrollEntry.where({ organizationId, payrollRunId: run.id }).all()
      ).filter((entry) => input.entryIds.includes(entry.id));
      if (entries.length !== new Set(input.entryIds).size)
        throw new BadRequestException("One or more payroll entries are invalid");
      const payments = await tx.orm.public.PayrollPayment.where({ organizationId }).all();
      const obligations = entries.map((entry) => {
        const paid = payments
          .filter((payment) => payment.payrollEntryId === entry.id)
          .reduce((sum, payment) => sum + cents(payment.amount), 0n);
        const outstanding = cents(entry.netPay) - paid;
        if (outstanding <= 0n)
          throw new ConflictException(`${entry.employeeName} has no unpaid balance`);
        return { entry, outstanding };
      });
      const total = obligations.reduce((sum, item) => sum + item.outstanding, 0n);
      const batch = await tx.orm.public.PayrollPaymentBatch.create({
        organizationId,
        payrollRunId: run.id,
        bankAccountId: input.bankAccountId ?? null,
        name: input.name.trim(),
        currency: run.currency,
        totalAmount: money(total),
        createdById: this.tenant.userId,
      });
      for (const { entry, outstanding } of obligations)
        await tx.orm.public.PayrollPaymentBatchItem.create({
          organizationId,
          batchId: batch.id,
          payrollEntryId: entry.id,
          employeeName: entry.employeeName,
          amount: money(outstanding),
        });
      await this.audit(
        "PAYMENT_BATCH",
        batch.id,
        "CREATED",
        { count: obligations.length, total: money(total) },
        tx,
      );
      return batch;
    });
  }

  async listPaymentObligations() {
    const organizationId = this.tenant.organizationId;
    const [runs, entries, payments, batchItems] = await Promise.all([
      this.db.orm.public.PayrollRun.where({ organizationId, status: "FINALIZED" }).all(),
      this.db.orm.public.PayrollEntry.where({ organizationId }).all(),
      this.db.orm.public.PayrollPayment.where({ organizationId }).all(),
      this.db.orm.public.PayrollPaymentBatchItem.where({ organizationId }).all(),
    ]);
    const runById = new Map(runs.map((run) => [run.id, run]));
    const batched = new Set(batchItems.map((item) => item.payrollEntryId));
    return entries.flatMap((entry) => {
      const run = runById.get(entry.payrollRunId);
      if (!run || batched.has(entry.id)) return [];
      const paid = payments
        .filter((payment) => payment.payrollEntryId === entry.id)
        .reduce((sum, payment) => sum + cents(payment.amount), 0n);
      const outstanding = cents(entry.netPay) - paid;
      return outstanding > 0n
        ? [
            {
              id: entry.id,
              payrollRunId: run.id,
              payrollRunName: run.name,
              employeeName: entry.employeeName,
              currency: run.currency,
              amount: money(outstanding),
              paymentDate: day(run.paymentDate),
            },
          ]
        : [];
    });
  }

  async listPaymentBatches() {
    const organizationId = this.tenant.organizationId;
    const batches = await this.db.orm.public.PayrollPaymentBatch.where({ organizationId })
      .orderBy((row) => row.createdAt.desc())
      .all();
    const items = await this.db.orm.public.PayrollPaymentBatchItem.where({ organizationId }).all();
    return batches.map((batch) => ({
      ...batch,
      items: items.filter((item) => item.batchId === batch.id),
    }));
  }

  async updatePaymentBatchItem(batchId: string, itemId: string, input: PaymentBatchItemDto) {
    const organizationId = this.tenant.organizationId;
    return this.db.transaction(async (tx) => {
      const batch = await tx.orm.public.PayrollPaymentBatch.where({
        organizationId,
        id: batchId,
      }).first();
      const item = await tx.orm.public.PayrollPaymentBatchItem.where({
        organizationId,
        id: itemId,
        batchId,
      }).first();
      if (!batch || !item) throw new NotFoundException("Payment batch item not found");
      if (batch.version !== input.expectedVersion)
        throw new ConflictException("Payment batch changed. Reload and try again.");
      const updated = await tx.orm.public.PayrollPaymentBatchItem.where({
        organizationId,
        id: itemId,
      }).update({
        status: input.status,
        paymentReference: input.paymentReference?.trim() || null,
        attemptedAt: new Date(),
      });
      const items = await tx.orm.public.PayrollPaymentBatchItem.where({
        organizationId,
        batchId,
      }).all();
      const statuses = items.map((row) => (row.id === itemId ? input.status : row.status));
      const status = statuses.every((value) => value === "PAID")
        ? "COMPLETED"
        : statuses.some((value) => value !== "PENDING")
          ? "PROCESSING"
          : "DRAFT";
      await tx.orm.public.PayrollPaymentBatch.where({
        organizationId,
        id: batchId,
        version: input.expectedVersion,
      }).update({ status, version: input.expectedVersion + 1 });
      await this.audit(
        "PAYMENT_BATCH",
        batchId,
        "ITEM_UPDATED",
        { itemId, status: input.status },
        tx,
      );
      return updated;
    });
  }

  listAudit(query: BankingPageDto) {
    return this.db.orm.public.BankingAuditEvent.where({
      organizationId: this.tenant.organizationId,
    })
      .orderBy((row) => row.createdAt.desc())
      .limit(query.limit)
      .offset(query.offset)
      .all();
  }
}
