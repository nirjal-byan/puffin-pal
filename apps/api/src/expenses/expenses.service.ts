import { BadRequestException, Inject, Injectable, NotFoundException, Scope, UnauthorizedException } from "@nestjs/common";
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

@Injectable({ scope: Scope.REQUEST })
export class ExpensesService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(REQUEST) private readonly request: AuthenticatedRequest, private readonly storage: ReceiptStorageService) {}
  private get organizationId() { if (!this.request.auth) throw new UnauthorizedException(); return this.request.auth.organizationId; }
  private date(value: string) {
    try { return Temporal.Instant.from(`${value}T00:00:00Z`); }
    catch { throw new BadRequestException("Provide a valid expense date"); }
  }
  private publicExpense<T extends { receiptKey: string | null; receiptUrl: string | null }>(expense: T) {
    return Object.fromEntries(Object.entries(expense).filter(([key]) => key !== "receiptKey" && key !== "receiptUrl")) as Omit<T, "receiptKey" | "receiptUrl">;
  }
  private async find(id: string) {
    const expense = await this.db.orm.public.Expense.where({ organizationId: this.organizationId, id }).first();
    if (!expense) throw new NotFoundException("Expense not found");
    return expense;
  }
  async list(query: ExpenseQueryDto) {
    let rows = await this.db.orm.public.Expense.where({ organizationId: this.organizationId }).all();
    const search = query.search?.trim().toLowerCase();
    if (search) rows = rows.filter((row) => [row.title, row.description, row.vendor, row.notes].some((value) => value?.toLowerCase().includes(search)));
    if (query.category) rows = rows.filter((row) => row.category === query.category);
    if (query.from) rows = rows.filter((row) => row.date.toString().slice(0, 10) >= query.from!);
    if (query.to) rows = rows.filter((row) => row.date.toString().slice(0, 10) <= query.to!);
    const direction = query.order === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = query.sort === "amount" ? BigInt(a.amount.replace(".", "")) : String(a[query.sort]);
      const bv = query.sort === "amount" ? BigInt(b.amount.replace(".", "")) : String(b[query.sort]);
      return av < bv ? -direction : av > bv ? direction : 0;
    });
    return { items: rows.slice(query.offset, query.offset + query.limit).map((row) => this.publicExpense(row)), total: rows.length, limit: query.limit, offset: query.offset };
  }
  async get(id: string) {
    return this.publicExpense(await this.find(id));
  }
  async create(input: CreateExpenseDto) {
    return this.publicExpense(await this.db.orm.public.Expense.create({ organizationId: this.organizationId, title: input.title.trim(), description: input.description?.trim() || null, amount: expenseAmount(input.amount), category: input.category, date: this.date(input.date), vendor: input.vendor?.trim() || null, notes: input.notes?.trim() || null }));
  }
  async update(id: string, input: UpdateExpenseDto) {
    await this.find(id);
    const updated = await this.db.orm.public.Expense.where({ organizationId: this.organizationId, id }).update({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.amount !== undefined ? { amount: expenseAmount(input.amount) } : {}), ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.date !== undefined ? { date: this.date(input.date) } : {}), ...(input.vendor !== undefined ? { vendor: input.vendor.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
    });
    if (!updated) throw new NotFoundException("Expense not found");
    return this.publicExpense(updated);
  }
  async remove(id: string) {
    const expense = await this.find(id);
    const receipt = expense.receiptKey ? await this.storage.get(expense.receiptKey) : null;
    if (expense.receiptKey) await this.storage.delete(expense.receiptKey);
    try { await this.db.orm.public.Expense.where({ organizationId: this.organizationId, id }).delete(); }
    catch (error) {
      if (expense.receiptKey && receipt && expense.receiptMime)
        await this.storage.put(expense.receiptKey, { originalname: expense.receiptName ?? "receipt", mimetype: expense.receiptMime, size: receipt.length, buffer: receipt }).catch(() => undefined);
      throw error;
    }
    return { message: "Expense deleted successfully." };
  }
  async uploadReceipt(id: string, input?: ReceiptFile) {
    const expense = await this.find(id); const file = validateReceipt(input);
    const extension = file.mimetype === "application/pdf" ? "pdf" : file.mimetype.split("/")[1]!.replace("jpeg", "jpg");
    const key = `organizations/${this.organizationId}/expenses/${id}/${randomUUID()}.${extension}`;
    await this.storage.put(key, file);
    try {
      const updated = await this.db.orm.public.Expense.where({ organizationId: this.organizationId, id }).update({ receiptKey: key, receiptName: file.originalname.slice(0, 255), receiptMime: file.mimetype, receiptSize: file.size, receiptUrl: null });
      if (!updated) throw new NotFoundException("Expense not found");
      if (expense.receiptKey) {
        try { await this.storage.delete(expense.receiptKey); }
        catch (error) {
          await this.db.orm.public.Expense.where({ organizationId: this.organizationId, id }).update({ receiptKey: expense.receiptKey, receiptName: expense.receiptName, receiptMime: expense.receiptMime, receiptSize: expense.receiptSize, receiptUrl: expense.receiptUrl });
          await this.storage.delete(key).catch(() => undefined);
          throw error;
        }
      }
      return this.publicExpense(updated);
    } catch (error) { await this.storage.delete(key).catch(() => undefined); throw error; }
  }
  async receipt(id: string) { const expense = await this.find(id); if (!expense.receiptKey || !expense.receiptMime) throw new NotFoundException("Receipt not found"); return { expense, buffer: await this.storage.get(expense.receiptKey) }; }
  async removeReceipt(id: string) { const expense = await this.find(id); if (!expense.receiptKey || !expense.receiptMime) throw new NotFoundException("Receipt not found"); const receipt = await this.storage.get(expense.receiptKey); await this.storage.delete(expense.receiptKey); try { await this.db.orm.public.Expense.where({ organizationId: this.organizationId, id }).update({ receiptKey: null, receiptName: null, receiptMime: null, receiptSize: null, receiptUrl: null }); } catch (error) { await this.storage.put(expense.receiptKey, { originalname: expense.receiptName ?? "receipt", mimetype: expense.receiptMime, size: receipt.length, buffer: receipt }).catch(() => undefined); throw error; } return { message: "Receipt removed successfully." }; }
}
