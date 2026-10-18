import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type { CreateExpenseDto, ExpenseQueryDto, UpdateExpenseDto } from "./expense.dto.js";
import { expenseAmount } from "./expense-money.js";
import { ReceiptStorageService } from "./receipt-storage.service.js";
import { validateReceipt } from "./receipt-validation.js";
import type { ReceiptFile } from "./receipt-validation.js";

type ExpenseStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
type ApprovalAction = "SUBMITTED" | "APPROVED" | "REJECTED" | "REOPENED" | "RESUBMITTED";

@Injectable({ scope: Scope.REQUEST })
export class ExpensesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    private readonly storage: ReceiptStorageService,
  ) {}
  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }
  private get organizationId() {
    return this.tenant.organizationId;
  }
  private get userId() {
    return this.tenant.userId;
  }
  private get canReview() {
    return this.tenant.role === "OWNER" || this.tenant.role === "ADMIN";
  }
  private date(value: string) {
    try {
      return Temporal.Instant.from(`${value}T00:00:00Z`);
    } catch {
      throw new BadRequestException("Provide a valid expense date");
    }
  }
  private publicExpense<T extends { receiptKey: string | null; receiptUrl: string | null }>(
    expense: T,
  ) {
    return Object.fromEntries(
      Object.entries(expense).filter(([key]) => key !== "receiptKey" && key !== "receiptUrl"),
    ) as Omit<T, "receiptKey" | "receiptUrl">;
  }
  private async find(id: string) {
    const expense = await this.db.orm.public.Expense.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!expense) throw new NotFoundException("Expense not found");
    return expense;
  }

  private async details(
    expense: Awaited<ReturnType<ExpensesService["find"]>>,
    includeHistory = false,
  ) {
    const userIds = [expense.createdByUserId, expense.submittedById, expense.reviewedById].filter(
      (value): value is string => Boolean(value),
    );
    const users = userIds.length
      ? (
          await this.db.orm.public.User.where({ organizationId: this.organizationId })
            .select("id", "fullName")
            .all()
        ).filter((user) => userIds.includes(user.id))
      : [];
    const names = new Map(users.map((user) => [user.id, user.fullName]));
    const history = includeHistory
      ? await this.db.orm.public.ExpenseApprovalHistory.where({
          organizationId: this.organizationId,
          expenseId: expense.id,
        })
          .orderBy((row) => row.createdAt.asc())
          .all()
      : [];
    const actorIds = history.map((event) => event.actorId);
    const actors = actorIds.length
      ? (
          await this.db.orm.public.User.where({ organizationId: this.organizationId })
            .select("id", "fullName")
            .all()
        ).filter((user) => actorIds.includes(user.id))
      : [];
    const actorNames = new Map(actors.map((user) => [user.id, user.fullName]));
    return {
      ...this.publicExpense(expense),
      createdBy: expense.createdByUserId
        ? {
            id: expense.createdByUserId,
            fullName: names.get(expense.createdByUserId) ?? "Former member",
          }
        : null,
      submittedBy: expense.submittedById
        ? {
            id: expense.submittedById,
            fullName: names.get(expense.submittedById) ?? "Former member",
          }
        : null,
      reviewedBy: expense.reviewedById
        ? { id: expense.reviewedById, fullName: names.get(expense.reviewedById) ?? "Former member" }
        : null,
      ...(includeHistory
        ? {
            approvalHistory: history.map((event) => ({
              ...event,
              actor: {
                id: event.actorId,
                fullName: actorNames.get(event.actorId) ?? "Former member",
              },
            })),
          }
        : {}),
    };
  }

  async list(query: ExpenseQueryDto) {
    let rows = await this.db.orm.public.Expense.where({
      organizationId: this.organizationId,
    }).all();
    const search = query.search?.trim().toLowerCase();
    if (search)
      rows = rows.filter((row) =>
        [row.title, row.description, row.vendor, row.notes].some((value) =>
          value?.toLowerCase().includes(search),
        ),
      );
    if (query.category) rows = rows.filter((row) => row.category === query.category);
    const pendingCount = rows.filter((row) => row.approvalStatus === "PENDING_APPROVAL").length;
    if (query.approvalStatus)
      rows = rows.filter((row) => row.approvalStatus === query.approvalStatus);
    if (query.submittedById) {
      if (!this.canReview && query.submittedById !== this.userId)
        throw new ForbiddenException("You can only filter your own submissions");
      rows = rows.filter((row) => row.submittedById === query.submittedById);
    }
    if (query.from) rows = rows.filter((row) => row.date.toString().slice(0, 10) >= query.from!);
    if (query.to) rows = rows.filter((row) => row.date.toString().slice(0, 10) <= query.to!);
    const direction = query.order === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av =
        query.sort === "amount" ? BigInt(a.amount.replace(".", "")) : String(a[query.sort]);
      const bv =
        query.sort === "amount" ? BigInt(b.amount.replace(".", "")) : String(b[query.sort]);
      return av < bv ? -direction : av > bv ? direction : 0;
    });
    const selected = rows.slice(query.offset, query.offset + query.limit);
    return {
      items: await Promise.all(selected.map((row) => this.details(row))),
      total: rows.length,
      pendingCount,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async get(id: string) {
    return this.details(await this.find(id), true);
  }
  async create(input: CreateExpenseDto) {
    const expense = await this.db.orm.public.Expense.create({
      organizationId: this.organizationId,
      createdByUserId: this.userId,
      approvalStatus: "DRAFT",
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: expenseAmount(input.amount),
      category: input.category,
      date: this.date(input.date),
      vendor: input.vendor?.trim() || null,
      notes: input.notes?.trim() || null,
    });
    return this.details(expense);
  }

  private assertDraftOwner(expense: Awaited<ReturnType<ExpensesService["find"]>>) {
    if (expense.approvalStatus !== "DRAFT")
      throw new ConflictException("Only draft expenses can be changed");
    if (
      !this.canReview &&
      expense.createdByUserId !== this.userId &&
      expense.submittedById !== this.userId
    )
      throw new ForbiddenException("You cannot change this expense");
  }
  async update(id: string, input: UpdateExpenseDto) {
    const expense = await this.find(id);
    this.assertDraftOwner(expense);
    const { expectedVersion } = input;
    const [updated] = await this.db.orm.public.Expense.where({
      organizationId: this.organizationId,
      id,
      approvalStatus: "DRAFT",
      version: expectedVersion,
    }).updateAll({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.amount !== undefined ? { amount: expenseAmount(input.amount) } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.date !== undefined ? { date: this.date(input.date) } : {}),
      ...(input.vendor !== undefined ? { vendor: input.vendor.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      version: expectedVersion + 1,
    });
    if (!updated) throw new ConflictException("Expense changed. Reload and try again.");
    return this.details(updated);
  }
  async remove(id: string) {
    const expense = await this.find(id);
    this.assertDraftOwner(expense);
    const history = await this.db.orm.public.ExpenseApprovalHistory.where({
      organizationId: this.organizationId,
      expenseId: id,
    }).first();
    if (history) throw new ConflictException("An expense with approval history cannot be deleted");
    const receipt = expense.receiptKey ? await this.storage.get(expense.receiptKey) : null;
    if (expense.receiptKey) await this.storage.delete(expense.receiptKey);
    try {
      await this.db.orm.public.Expense.where({
        organizationId: this.organizationId,
        id,
        approvalStatus: "DRAFT",
      }).delete();
    } catch (error) {
      if (expense.receiptKey && receipt && expense.receiptMime)
        await this.storage
          .put(expense.receiptKey, {
            originalname: expense.receiptName ?? "receipt",
            mimetype: expense.receiptMime,
            size: receipt.length,
            buffer: receipt,
          })
          .catch(() => undefined);
      throw error;
    }
    return { message: "Expense deleted successfully." };
  }

  private async transition(
    id: string,
    expectedVersion: number,
    from: ExpenseStatus,
    to: ExpenseStatus,
    action: ApprovalAction,
    reason?: string,
  ) {
    const organizationId = this.organizationId;
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM expenses WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const expense = await tx.orm.public.Expense.where({ organizationId, id }).first();
      if (!expense) throw new NotFoundException("Expense not found");
      if (expense.approvalStatus !== from || expense.version !== expectedVersion)
        throw new ConflictException(
          "Expense changed or is no longer eligible for this action. Reload and try again.",
        );
      const now = Temporal.Now.instant();
      if (action === "APPROVED" || action === "REJECTED") {
        if (!this.canReview) throw new ForbiddenException("You cannot review expenses");
        if (expense.submittedById === this.userId)
          throw new ForbiddenException("You cannot review your own expense");
      } else if (
        !this.canReview &&
        expense.createdByUserId !== this.userId &&
        expense.submittedById !== this.userId
      )
        throw new ForbiddenException("You cannot submit or revise this expense");
      const [updated] = await tx.orm.public.Expense.where({
        organizationId,
        id,
        approvalStatus: from,
        version: expectedVersion,
      }).updateAll({
        approvalStatus: to,
        version: expectedVersion + 1,
        ...(to === "PENDING_APPROVAL"
          ? {
              submittedById: this.userId,
              submittedAt: now,
              reviewedById: null,
              reviewedAt: null,
              rejectionReason: null,
            }
          : {}),
        ...(to === "APPROVED"
          ? { reviewedById: this.userId, reviewedAt: now, rejectionReason: null }
          : {}),
        ...(to === "REJECTED"
          ? { reviewedById: this.userId, reviewedAt: now, rejectionReason: reason!.trim() }
          : {}),
        ...(to === "DRAFT" ? { reviewedById: null, reviewedAt: null, rejectionReason: null } : {}),
      });
      if (!updated) throw new ConflictException("Expense changed. Reload and try again.");
      await tx.orm.public.ExpenseApprovalHistory.create({
        organizationId,
        expenseId: id,
        actorId: this.userId,
        action,
        previousStatus: from,
        newStatus: to,
        rejectionReason: reason?.trim() || null,
      });
      return this.publicExpense(updated);
    });
  }
  async submit(id: string, expectedVersion: number) {
    const prior = await this.db.orm.public.ExpenseApprovalHistory.where({
      organizationId: this.organizationId,
      expenseId: id,
    }).first();
    return this.transition(
      id,
      expectedVersion,
      "DRAFT",
      "PENDING_APPROVAL",
      prior ? "RESUBMITTED" : "SUBMITTED",
    );
  }
  async approve(id: string, expectedVersion: number) {
    return this.transition(id, expectedVersion, "PENDING_APPROVAL", "APPROVED", "APPROVED");
  }
  async reject(id: string, expectedVersion: number, reason: string) {
    if (!reason.trim()) throw new BadRequestException("A rejection reason is required");
    return this.transition(id, expectedVersion, "PENDING_APPROVAL", "REJECTED", "REJECTED", reason);
  }
  async reopen(id: string, expectedVersion: number) {
    return this.transition(id, expectedVersion, "REJECTED", "DRAFT", "REOPENED");
  }

  private async editableReceiptExpense(id: string) {
    const expense = await this.find(id);
    this.assertDraftOwner(expense);
    return expense;
  }
  async uploadReceipt(id: string, input?: ReceiptFile) {
    const expense = await this.editableReceiptExpense(id);
    const file = validateReceipt(input);
    const extension =
      file.mimetype === "application/pdf"
        ? "pdf"
        : file.mimetype.split("/")[1]!.replace("jpeg", "jpg");
    const key = `organizations/${this.organizationId}/expenses/${id}/${randomUUID()}.${extension}`;
    await this.storage.put(key, file);
    try {
      const [updated] = await this.db.orm.public.Expense.where({
        organizationId: this.organizationId,
        id,
        approvalStatus: "DRAFT",
        version: expense.version,
      }).updateAll({
        receiptKey: key,
        receiptName: file.originalname.slice(0, 255),
        receiptMime: file.mimetype,
        receiptSize: file.size,
        receiptUrl: null,
        version: expense.version + 1,
      });
      if (!updated) throw new ConflictException("Expense changed. Reload and try again.");
      if (expense.receiptKey) {
        try {
          await this.storage.delete(expense.receiptKey);
        } catch (error) {
          await this.db.orm.public.Expense.where({
            organizationId: this.organizationId,
            id,
          }).update({
            receiptKey: expense.receiptKey,
            receiptName: expense.receiptName,
            receiptMime: expense.receiptMime,
            receiptSize: expense.receiptSize,
            receiptUrl: expense.receiptUrl,
            version: expense.version,
          });
          await this.storage.delete(key).catch(() => undefined);
          throw error;
        }
      }
      return this.details(updated);
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }
  async receipt(id: string) {
    const expense = await this.find(id);
    if (!expense.receiptKey || !expense.receiptMime)
      throw new NotFoundException("Receipt not found");
    return { expense, buffer: await this.storage.get(expense.receiptKey) };
  }
  async removeReceipt(id: string) {
    const expense = await this.editableReceiptExpense(id);
    if (!expense.receiptKey || !expense.receiptMime)
      throw new NotFoundException("Receipt not found");
    const receipt = await this.storage.get(expense.receiptKey);
    await this.storage.delete(expense.receiptKey);
    try {
      const [updated] = await this.db.orm.public.Expense.where({
        organizationId: this.organizationId,
        id,
        approvalStatus: "DRAFT",
        version: expense.version,
      }).updateAll({
        receiptKey: null,
        receiptName: null,
        receiptMime: null,
        receiptSize: null,
        receiptUrl: null,
        version: expense.version + 1,
      });
      if (!updated) throw new ConflictException("Expense changed. Reload and try again.");
    } catch (error) {
      await this.storage
        .put(expense.receiptKey, {
          originalname: expense.receiptName ?? "receipt",
          mimetype: expense.receiptMime,
          size: receipt.length,
          buffer: receipt,
        })
        .catch(() => undefined);
      throw error;
    }
    return { message: "Receipt removed successfully." };
  }
}
