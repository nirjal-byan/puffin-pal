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
import { ObjectStorageService } from "../../infrastructure/storage/object-storage.service.js";
import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import type {
  CreateVendorBillDto,
  PayablesQueryDto,
  RecordPayablePaymentDto,
  RejectBillDto,
  ReversePayablePaymentDto,
  UpdateVendorBillDto,
  VendorDto,
} from "./accounts-payable.dto.js";

type OrmDb = Pick<Database, "orm">;
type BillStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "VOIDED";
type BillAction = "BILL_SUBMITTED" | "BILL_APPROVED" | "BILL_REJECTED" | "BILL_VOIDED";
type PayableAuditAction =
  | "VENDOR_CREATED"
  | "VENDOR_UPDATED"
  | "VENDOR_ARCHIVED"
  | "BILL_CREATED"
  | "BILL_UPDATED"
  | BillAction
  | "PAYMENT_RECORDED"
  | "PAYMENT_REVERSED";
function scaled(value: string, places: number) {
  if (!/^\d+(\.\d+)?$/.test(value))
    throw new BadRequestException("Provide a valid non-negative number");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > places)
    throw new BadRequestException(`Use at most ${places} decimal places`);
  return BigInt(whole!) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0"));
}
function decimal(value: bigint, places = 2) {
  const divisor = 10n ** BigInt(places);
  return `${value / divisor}.${String(value % divisor).padStart(places, "0")}`;
}
const money = (value: bigint) => decimal(value) as Numeric<14, 2>;
const date = (value: string) => Temporal.Instant.from(`${value.slice(0, 10)}T00:00:00Z`);
const day = (value: { toString(): string } | string) => value.toString().slice(0, 10);
const millis = (value: { toString(): string }) =>
  Number(Temporal.Instant.from(value.toString()).epochMilliseconds);
const now = () => Temporal.Now.instant();

@Injectable({ scope: Scope.REQUEST })
export class AccountsPayableService {
  private todayValue?: Promise<Temporal.PlainDate>;
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    private readonly storage: ObjectStorageService,
  ) {}
  private get tenant() {
    if (!this.request.auth) throw new Error("Authenticated tenant is required");
    return this.request.auth;
  }
  private today() {
    this.todayValue ??= this.db.orm.public.Organization.where({
      id: this.tenant.organizationId,
    })
      .select("timezone")
      .first()
      .then((organization) =>
        Temporal.Now.instant()
          .toZonedDateTimeISO(organization?.timezone ?? "UTC")
          .toPlainDate(),
      );
    return this.todayValue;
  }
  private audit(
    entityType: string,
    entityId: string,
    action: PayableAuditAction,
    details?: unknown,
    tx: OrmDb = this.db,
  ) {
    return tx.orm.public.PayableAuditEvent.create({
      organizationId: this.tenant.organizationId,
      actorId: this.tenant.userId,
      entityType,
      entityId,
      action,
      details: details === undefined ? null : JSON.stringify(details),
    });
  }
  private async vendor(id: string) {
    const row = await this.db.orm.public.Vendor.where({
      organizationId: this.tenant.organizationId,
      id,
    }).first();
    if (!row) throw new NotFoundException("Vendor not found");
    return row;
  }
  async listVendors(query: PayablesQueryDto) {
    let rows = await this.db.orm.public.Vendor.where({
      organizationId: this.tenant.organizationId,
    }).all();
    if (query.search) {
      const term = query.search.toLowerCase();
      rows = rows.filter((row) =>
        [row.name, row.displayName, row.email].some((v) => v?.toLowerCase().includes(term)),
      );
    }
    if (query.active !== undefined) rows = rows.filter((row) => row.active === query.active);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return {
      items: rows.slice(query.offset, query.offset + query.limit),
      total: rows.length,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async getVendor(id: string) {
    const vendor = await this.vendor(id);
    const bills = await this.db.orm.public.VendorBill.where({
      organizationId: this.tenant.organizationId,
      vendorId: id,
    }).all();
    const detailed = await Promise.all(bills.map((bill) => this.decorateBill(bill)));
    return {
      ...vendor,
      bills: detailed,
      balance: money(detailed.reduce((sum, bill) => sum + scaled(bill.balance, 2), 0n)),
    };
  }
  createVendor(input: VendorDto) {
    const organizationId = this.tenant.organizationId;
    return this.db.transaction(async (tx) => {
      const vendor = await tx.orm.public.Vendor.create({
        organizationId,
        ...input,
        displayName: input.displayName || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        address: input.address || null,
        country: input.country || null,
        taxId: input.taxId || null,
        notes: input.notes || null,
        defaultCurrency: input.defaultCurrency.toUpperCase(),
      });
      await this.audit("vendor", vendor.id, "VENDOR_CREATED", undefined, tx);
      return vendor;
    });
  }
  async updateVendor(id: string, input: VendorDto & { expectedVersion: number }) {
    await this.vendor(id);
    const [vendor] = await this.db.orm.public.Vendor.where({
      organizationId: this.tenant.organizationId,
      id,
      version: input.expectedVersion,
    }).updateAll({
      name: input.name,
      displayName: input.displayName || null,
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
      address: input.address || null,
      country: input.country || null,
      defaultCurrency: input.defaultCurrency.toUpperCase(),
      taxId: input.taxId || null,
      paymentTermsDays: input.paymentTermsDays,
      notes: input.notes || null,
      version: input.expectedVersion + 1,
    });
    if (!vendor) throw new ConflictException("Vendor changed. Reload and try again.");
    await this.audit("vendor", id, "VENDOR_UPDATED");
    return vendor;
  }
  async archiveVendor(id: string) {
    await this.vendor(id);
    const open = (
      await this.db.orm.public.VendorBill.where({
        organizationId: this.tenant.organizationId,
        vendorId: id,
      }).all()
    ).filter((bill) => !["VOIDED", "REJECTED"].includes(bill.status));
    for (const bill of open)
      if (scaled((await this.decorateBill(bill)).balance, 2) > 0n)
        throw new ConflictException("A vendor with an outstanding balance cannot be archived");
    const [vendor] = await this.db.orm.public.Vendor.where({
      organizationId: this.tenant.organizationId,
      id,
      active: true,
    }).updateAll({ active: false, archivedAt: now() });
    if (!vendor) throw new ConflictException("Vendor is already archived");
    await this.audit("vendor", id, "VENDOR_ARCHIVED");
    return vendor;
  }
  private async bill(id: string) {
    const row = await this.db.orm.public.VendorBill.where({
      organizationId: this.tenant.organizationId,
      id,
    }).first();
    if (!row) throw new NotFoundException("Vendor bill not found");
    return row;
  }
  private async decorateBill<
    T extends { id: string; totalAmount: string; status: BillStatus; dueDate: Date },
  >(bill: T) {
    const payments = await this.db.orm.public.PayablePayment.where({
      organizationId: this.tenant.organizationId,
      vendorBillId: bill.id,
    }).all();
    const paid = payments
      .filter((p) => !p.reversedAt)
      .reduce((sum, p) => sum + scaled(p.amount, 2), 0n);
    const total = scaled(bill.totalAmount, 2);
    const balance = total > paid ? total - paid : 0n;
    const settlementStatus = paid === 0n ? "UNPAID" : balance === 0n ? "PAID" : "PARTIALLY_PAID";
    const today = await this.today();
    return {
      ...bill,
      paidAmount: money(paid),
      balance: money(balance),
      settlementStatus,
      overdue:
        bill.status === "APPROVED" &&
        balance > 0n &&
        Temporal.PlainDate.compare(Temporal.PlainDate.from(day(bill.dueDate)), today) < 0,
    };
  }
  async listBills(query: PayablesQueryDto) {
    let rows = await this.db.orm.public.VendorBill.where({
      organizationId: this.tenant.organizationId,
    }).all();
    if (query.vendorId) rows = rows.filter((r) => r.vendorId === query.vendorId);
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    if (query.search) {
      const term = query.search.toLowerCase();
      rows = rows.filter((r) =>
        [r.billNumber, r.vendorReference, r.description].some((v) =>
          v?.toLowerCase().includes(term),
        ),
      );
    }
    rows.sort((a, b) => millis(b.issueDate) - millis(a.issueDate));
    return {
      items: await Promise.all(
        rows.slice(query.offset, query.offset + query.limit).map((r) => this.decorateBill(r)),
      ),
      total: rows.length,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async getBill(id: string) {
    const bill = await this.bill(id);
    const [items, payments, vendor, audit] = await Promise.all([
      this.db.orm.public.VendorBillItem.where({
        organizationId: this.tenant.organizationId,
        vendorBillId: id,
      }).all(),
      this.db.orm.public.PayablePayment.where({
        organizationId: this.tenant.organizationId,
        vendorBillId: id,
      }).all(),
      this.vendor(bill.vendorId),
      this.db.orm.public.PayableAuditEvent.where({
        organizationId: this.tenant.organizationId,
        entityId: id,
      }).all(),
    ]);
    return { ...(await this.decorateBill(bill)), vendor, items, payments, audit };
  }
  async uploadAttachment(
    id: string,
    file?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException("Choose a bill attachment");
    if (!new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]).has(file.mimetype))
      throw new BadRequestException("Use a PDF, JPEG, PNG, or WebP attachment");
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException("Attachment must be 5 MB or smaller");
    const bill = await this.bill(id);
    if (!["DRAFT", "REJECTED"].includes(bill.status))
      throw new ConflictException("Attachments can only be changed before approval");
    const key = `organizations/${this.tenant.organizationId}/vendor-bills/${id}/${randomUUID()}`;
    await this.storage.put(key, file.buffer, file.mimetype, {
      organizationId: this.tenant.organizationId,
      vendorBillId: id,
    });
    const [updated] = await this.db.orm.public.VendorBill.where({
      organizationId: this.tenant.organizationId,
      id,
      version: bill.version,
    }).updateAll({
      attachmentKey: key,
      attachmentName: file.originalname,
      attachmentMime: file.mimetype,
      attachmentSize: file.size,
      version: bill.version + 1,
    });
    if (!updated) {
      await this.storage.delete(key);
      throw new ConflictException("Bill changed. Reload and try again.");
    }
    if (bill.attachmentKey) await this.storage.delete(bill.attachmentKey).catch(() => undefined);
    return {
      attachmentName: updated.attachmentName,
      attachmentMime: updated.attachmentMime,
      attachmentSize: updated.attachmentSize,
      version: updated.version,
    };
  }
  async attachment(id: string) {
    const bill = await this.bill(id);
    if (!bill.attachmentKey) throw new NotFoundException("Bill attachment not found");
    return { bill, object: await this.storage.get(bill.attachmentKey) };
  }
  async removeAttachment(id: string) {
    const bill = await this.bill(id);
    if (!bill.attachmentKey) throw new NotFoundException("Bill attachment not found");
    if (!["DRAFT", "REJECTED"].includes(bill.status))
      throw new ConflictException("Approved bill attachments are historical records");
    const [updated] = await this.db.orm.public.VendorBill.where({
      organizationId: this.tenant.organizationId,
      id,
      version: bill.version,
    }).updateAll({
      attachmentKey: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null,
      version: bill.version + 1,
    });
    if (!updated) throw new ConflictException("Bill changed. Reload and try again.");
    await this.storage.delete(bill.attachmentKey);
    return { message: "Attachment removed", version: updated.version };
  }
  async createBill(input: CreateVendorBillDto) {
    const organizationId = this.tenant.organizationId;
    const vendor = await this.vendor(input.vendorId);
    if (!vendor.active) throw new ConflictException("Archived vendors cannot receive new bills");
    if (
      await this.db.orm.public.VendorBill.where({
        organizationId,
        billNumber: input.billNumber,
      }).first()
    )
      throw new ConflictException("A bill with this number already exists");
    if (day(date(input.dueDate)) < day(date(input.issueDate)))
      throw new BadRequestException("Due date cannot be before issue date");
    if (input.expenseId) {
      const expense = await this.db.orm.public.Expense.where({
        organizationId,
        id: input.expenseId,
        approvalStatus: "APPROVED",
      }).first();
      if (!expense) throw new BadRequestException("Linked expense must exist and be approved");
    }
    const items = input.items.map((item, position) => {
      const quantity = scaled(item.quantity, 4);
      const unit = scaled(item.unitPrice, 2);
      const tax = scaled(item.taxAmount ?? "0", 2);
      const discount = scaled(item.discountAmount ?? "0", 2);
      const base = (quantity * unit + 5000n) / 10000n;
      const lineTotal = base + tax - discount;
      if (lineTotal < 0n)
        throw new BadRequestException("Line discount cannot exceed its amount and tax");
      return {
        ...item,
        position,
        quantity: decimal(quantity, 4) as Numeric<12, 4>,
        unitPrice: money(unit),
        taxAmount: money(tax),
        discountAmount: money(discount),
        lineTotal: money(lineTotal),
        cents: lineTotal,
      };
    });
    const subtotal = items.reduce(
      (sum, item) => sum + (scaled(item.quantity, 4) * scaled(item.unitPrice, 2) + 5000n) / 10000n,
      0n,
    );
    const tax = items.reduce((s, i) => s + scaled(i.taxAmount, 2), 0n);
    const discount = items.reduce((s, i) => s + scaled(i.discountAmount, 2), 0n);
    const total = items.reduce((s, i) => s + i.cents, 0n);
    return this.db.transaction(async (tx) => {
      const bill = await tx.orm.public.VendorBill.create({
        organizationId,
        vendorId: input.vendorId,
        expenseId: input.expenseId ?? null,
        billNumber: input.billNumber,
        vendorReference: input.vendorReference || null,
        issueDate: date(input.issueDate),
        dueDate: date(input.dueDate),
        currency: input.currency.toUpperCase(),
        description: input.description || null,
        subtotal: money(subtotal),
        taxAmount: money(tax),
        discountAmount: money(discount),
        totalAmount: money(total),
        createdById: this.tenant.userId,
      });
      for (const item of items)
        await tx.orm.public.VendorBillItem.create({
          organizationId,
          vendorBillId: bill.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxAmount: item.taxAmount,
          discountAmount: item.discountAmount,
          lineTotal: item.lineTotal,
          position: item.position,
        });
      await this.audit("vendor_bill", bill.id, "BILL_CREATED", { total: money(total) }, tx);
      return bill;
    });
  }
  async updateBill(id: string, input: UpdateVendorBillDto) {
    const organizationId = this.tenant.organizationId;
    const current = await this.bill(id);
    if (current.status !== "DRAFT") throw new ConflictException("Only draft bills can be edited");
    await this.vendor(input.vendorId);
    const duplicate = await this.db.orm.public.VendorBill.where({
      organizationId,
      billNumber: input.billNumber,
    }).first();
    if (duplicate && duplicate.id !== id)
      throw new ConflictException("A bill with this number already exists");
    if (day(date(input.dueDate)) < day(date(input.issueDate)))
      throw new BadRequestException("Due date cannot be before issue date");
    const items = input.items.map((item, position) => {
      const quantity = scaled(item.quantity, 4);
      const unit = scaled(item.unitPrice, 2);
      const tax = scaled(item.taxAmount ?? "0", 2);
      const discount = scaled(item.discountAmount ?? "0", 2);
      const base = (quantity * unit + 5000n) / 10000n;
      const lineTotal = base + tax - discount;
      if (lineTotal < 0n)
        throw new BadRequestException("Line discount cannot exceed its amount and tax");
      return {
        description: item.description,
        position,
        quantity: decimal(quantity, 4) as Numeric<12, 4>,
        unitPrice: money(unit),
        taxAmount: money(tax),
        discountAmount: money(discount),
        lineTotal: money(lineTotal),
        base,
        cents: lineTotal,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.base, 0n);
    const tax = items.reduce((sum, item) => sum + scaled(item.taxAmount, 2), 0n);
    const discount = items.reduce((sum, item) => sum + scaled(item.discountAmount, 2), 0n);
    const total = items.reduce((sum, item) => sum + item.cents, 0n);
    return this.db.transaction(async (tx) => {
      const [bill] = await tx.orm.public.VendorBill.where({
        organizationId,
        id,
        status: "DRAFT",
        version: input.expectedVersion,
      }).updateAll({
        vendorId: input.vendorId,
        expenseId: input.expenseId ?? null,
        billNumber: input.billNumber,
        vendorReference: input.vendorReference || null,
        issueDate: date(input.issueDate),
        dueDate: date(input.dueDate),
        currency: input.currency.toUpperCase(),
        description: input.description || null,
        subtotal: money(subtotal),
        taxAmount: money(tax),
        discountAmount: money(discount),
        totalAmount: money(total),
        version: input.expectedVersion + 1,
      });
      if (!bill) throw new ConflictException("Bill changed. Reload and try again.");
      await tx.orm.public.VendorBillItem.where({ organizationId, vendorBillId: id }).deleteAll();
      for (const item of items)
        await tx.orm.public.VendorBillItem.create({
          organizationId,
          vendorBillId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxAmount: item.taxAmount,
          discountAmount: item.discountAmount,
          lineTotal: item.lineTotal,
          position: item.position,
        });
      await this.audit("vendor_bill", id, "BILL_UPDATED", { total: money(total) }, tx);
      return bill;
    });
  }
  async transitionBill(
    id: string,
    expectedVersion: number,
    from: BillStatus,
    to: BillStatus,
    action: BillAction,
  ) {
    await this.bill(id);
    return this.db.transaction(async (tx) => {
      const [bill] = await tx.orm.public.VendorBill.where({
        organizationId: this.tenant.organizationId,
        id,
        status: from,
        version: expectedVersion,
      }).updateAll({
        status: to,
        version: expectedVersion + 1,
        ...(to === "PENDING_APPROVAL" ? { submittedAt: now() } : {}),
        ...(to === "APPROVED" ? { approvedAt: now(), approvedById: this.tenant.userId } : {}),
        ...(to === "VOIDED" ? { voidedAt: now() } : {}),
      });
      if (!bill) throw new ConflictException(`Bill must be ${from.toLowerCase()} and unchanged`);
      if (to === "VOIDED") {
        const paid = await tx.orm.public.PayablePayment.where({
          organizationId: this.tenant.organizationId,
          vendorBillId: id,
        }).all();
        if (paid.some((p) => !p.reversedAt))
          throw new ConflictException("Reverse bill payments before voiding the bill");
      }
      await this.audit("vendor_bill", id, action, undefined, tx);
      return bill;
    });
  }
  rejectBill(id: string, input: RejectBillDto) {
    return this.transitionWithReason(id, input);
  }
  private async transitionWithReason(id: string, input: RejectBillDto) {
    await this.bill(id);
    return this.db.transaction(async (tx) => {
      const [bill] = await tx.orm.public.VendorBill.where({
        organizationId: this.tenant.organizationId,
        id,
        status: "PENDING_APPROVAL",
        version: input.expectedVersion,
      }).updateAll({
        status: "REJECTED",
        rejectionReason: input.reason,
        rejectedAt: now(),
        version: input.expectedVersion + 1,
      });
      if (!bill) throw new ConflictException("Bill changed or is not awaiting approval");
      await this.audit("vendor_bill", id, "BILL_REJECTED", { reason: input.reason }, tx);
      return bill;
    });
  }
  async recordPayment(input: RecordPayablePaymentDto) {
    const organizationId = this.tenant.organizationId;
    const amount = scaled(input.amount, 2);
    if (amount <= 0n) throw new BadRequestException("Payment amount must be greater than zero");
    const existing = await this.db.orm.public.PayablePayment.where({
      organizationId,
      idempotencyKey: input.idempotencyKey,
    }).first();
    if (existing) return existing;
    let total: bigint;
    let currency: string;
    let vendorBillId: string | null = null;
    let expenseId: string | null = null;
    if (input.targetType === "VENDOR_BILL") {
      const bill = await this.bill(input.targetId);
      if (bill.status !== "APPROVED")
        throw new ConflictException("Only approved bills can be paid");
      total = scaled(bill.totalAmount, 2);
      currency = bill.currency;
      vendorBillId = bill.id;
    } else {
      const expense = await this.db.orm.public.Expense.where({
        organizationId,
        id: input.targetId,
      }).first();
      if (!expense) throw new NotFoundException("Expense not found");
      if (expense.approvalStatus !== "APPROVED")
        throw new ConflictException("Only approved expenses can be paid");
      const linked = await this.db.orm.public.VendorBill.where({
        organizationId,
        expenseId: expense.id,
      }).first();
      if (linked) throw new ConflictException("Record payment against the linked vendor bill");
      total = scaled(expense.amount, 2);
      const org = await this.db.orm.public.Organization.where({ id: organizationId }).first();
      currency = org?.currency ?? "USD";
      expenseId = expense.id;
    }
    return this.db.transaction(async (tx) => {
      if (vendorBillId)
        await tx.execute(
          this.db.raw
            .sql`SELECT id FROM vendor_bills WHERE id = ${vendorBillId} AND "organizationId" = ${organizationId} FOR UPDATE`
            .affectedCount()
            .build(),
        );
      else
        await tx.execute(
          this.db.raw
            .sql`SELECT id FROM expenses WHERE id = ${expenseId!} AND "organizationId" = ${organizationId} FOR UPDATE`
            .affectedCount()
            .build(),
        );
      const payments =
        input.targetType === "VENDOR_BILL"
          ? await tx.orm.public.PayablePayment.where({ organizationId, vendorBillId }).all()
          : await tx.orm.public.PayablePayment.where({ organizationId, expenseId }).all();
      const paid = payments
        .filter((p) => !p.reversedAt)
        .reduce((s, p) => s + scaled(p.amount, 2), 0n);
      if (paid + amount > total)
        throw new ConflictException("Payment exceeds the outstanding balance");
      const payment = await tx.orm.public.PayablePayment.create({
        organizationId,
        targetType: input.targetType,
        vendorBillId,
        expenseId,
        bankAccountId: input.bankAccountId ?? null,
        amount: money(amount),
        currency,
        paymentDate: date(input.paymentDate),
        method: input.method,
        reference: input.reference || null,
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey,
        recordedById: this.tenant.userId,
      });
      await this.audit(
        "payable_payment",
        payment.id,
        "PAYMENT_RECORDED",
        { targetType: input.targetType, targetId: input.targetId, amount: money(amount) },
        tx,
      );
      return payment;
    });
  }
  listPayments(targetType: "VENDOR_BILL" | "EXPENSE", targetId: string) {
    return this.db.orm.public.PayablePayment.where({
      organizationId: this.tenant.organizationId,
      ...(targetType === "VENDOR_BILL" ? { vendorBillId: targetId } : { expenseId: targetId }),
    })
      .orderBy((row) => row.paymentDate.desc())
      .all();
  }
  async reversePayment(id: string, input: ReversePayablePaymentDto) {
    return this.db.transaction(async (tx) => {
      const reconciliation = await tx.orm.public.BankReconciliation.where({
        organizationId: this.tenant.organizationId,
        payablePaymentId: id,
      }).first();
      if (reconciliation && !reconciliation.reversedAt)
        throw new ConflictException(
          "Reverse the bank reconciliation before reversing this payment",
        );
      const [payment] = await tx.orm.public.PayablePayment.where({
        organizationId: this.tenant.organizationId,
        id,
        version: input.expectedVersion,
        reversedAt: null,
      }).updateAll({
        reversedAt: now(),
        reversedById: this.tenant.userId,
        reversalReason: input.reason,
        version: input.expectedVersion + 1,
      });
      if (!payment) throw new ConflictException("Payment changed, was reversed, or does not exist");
      await this.audit("payable_payment", id, "PAYMENT_REVERSED", { reason: input.reason }, tx);
      return payment;
    });
  }
  async summary() {
    const bills = await this.db.orm.public.VendorBill.where({
      organizationId: this.tenant.organizationId,
      status: "APPROVED",
    }).all();
    const details = await Promise.all(bills.map((bill) => this.decorateBill(bill)));
    const today = await this.today();
    const [payments, vendors] = await Promise.all([
      this.db.orm.public.PayablePayment.where({ organizationId: this.tenant.organizationId }).all(),
      this.db.orm.public.Vendor.where({ organizationId: this.tenant.organizationId }).all(),
    ]);
    const buckets = { current: 0n, days1to30: 0n, days31to60: 0n, days61to90: 0n, over90: 0n };
    for (const bill of details) {
      const balance = scaled(bill.balance, 2);
      const days = Temporal.PlainDate.from(day(bill.dueDate)).until(today).days;
      if (days <= 0) buckets.current += balance;
      else if (days <= 30) buckets.days1to30 += balance;
      else if (days <= 60) buckets.days31to60 += balance;
      else if (days <= 90) buckets.days61to90 += balance;
      else buckets.over90 += balance;
    }
    const vendorNames = new Map(
      vendors.map((vendor) => [vendor.id, vendor.displayName ?? vendor.name]),
    );
    const vendorBalances = new Map<string, bigint>();
    for (const bill of details)
      vendorBalances.set(
        bill.vendorId,
        (vendorBalances.get(bill.vendorId) ?? 0n) + scaled(bill.balance, 2),
      );
    const dueWithin = (limit: number) =>
      money(
        details
          .filter((bill) => {
            const days = today.until(Temporal.PlainDate.from(day(bill.dueDate))).days;
            return days >= 0 && days <= limit;
          })
          .reduce((sum, bill) => sum + scaled(bill.balance, 2), 0n),
      );
    return {
      outstanding: money(Object.values(buckets).reduce((a, b) => a + b, 0n)),
      overdue: money(buckets.days1to30 + buckets.days31to60 + buckets.days61to90 + buckets.over90),
      dueWithin7Days: dueWithin(7),
      dueWithin30Days: dueWithin(30),
      paidBills: details.filter((bill) => bill.settlementStatus === "PAID").length,
      partiallyPaidBills: details.filter((bill) => bill.settlementStatus === "PARTIALLY_PAID")
        .length,
      aging: Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, money(value)])),
      vendorBalances: [...vendorBalances]
        .filter(([, balance]) => balance > 0n)
        .map(([vendorId, balance]) => ({
          vendorId,
          vendor: vendorNames.get(vendorId) ?? "Vendor",
          balance: money(balance),
        })),
      recentPayments: payments
        .filter((payment) => !payment.reversedAt)
        .sort((a, b) => millis(b.paymentDate) - millis(a.paymentDate))
        .slice(0, 10),
    };
  }
}
