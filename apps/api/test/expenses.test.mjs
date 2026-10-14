import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { hasPermission } from "@puffinpal/permissions";
import { CreateExpenseDto, ExpenseQueryDto } from "../dist/src/expenses/expense.dto.js";
import { expenseAmount } from "../dist/src/expenses/expense-money.js";
import { validateReceipt } from "../dist/src/expenses/receipt-validation.js";
import { ExpensesService } from "../dist/src/expenses/expenses.service.js";

test("expense amounts remain exact and reject invalid values", () => {
  assert.equal(expenseAmount("0.10"), "0.10");
  assert.equal(expenseAmount("9999999999.99"), "9999999999.99");
  for (const value of ["0", "-1", "1e2", "0.001", "10000000000", ""]) assert.throws(() => expenseAmount(value));
});
test("expense DTO and filters reject invalid input", async () => {
  const valid = { title: "Hosting", amount: "12.34", category: "SOFTWARE", date: "2026-10-14" };
  assert.equal((await validate(plainToInstance(CreateExpenseDto, valid))).length, 0);
  for (const change of [{ title: "" }, { amount: "1.001" }, { category: "FOOD" }, { date: "14/10/2026" }, { organizationId: "other" }])
    assert.ok((await validate(plainToInstance(CreateExpenseDto, { ...valid, ...change }), { whitelist: true, forbidNonWhitelisted: true })).length);
  assert.equal((await validate(plainToInstance(ExpenseQueryDto, { limit: "20", offset: "0", category: "TRAVEL", order: "asc" }))).length, 0);
});
test("receipt validation checks MIME, size and signature", () => {
  const jpeg = { originalname: "receipt.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from([255, 216, 255, 217]) };
  assert.equal(validateReceipt(jpeg), jpeg);
  assert.throws(() => validateReceipt({ ...jpeg, mimetype: "image/png" }));
  assert.throws(() => validateReceipt({ ...jpeg, size: 6 * 1024 * 1024 }));
  assert.throws(() => validateReceipt({ ...jpeg, mimetype: "text/plain" }));
});
test("expense permissions match the role policy", () => {
  for (const role of ["OWNER", "ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
    assert.equal(hasPermission(role, "expenses:read"), true);
    assert.equal(hasPermission(role, "expenses:create"), role !== "FINANCE_VIEWER");
    assert.equal(hasPermission(role, "expenses:update"), role !== "FINANCE_VIEWER");
    assert.equal(hasPermission(role, "expenses:delete"), ["OWNER", "ADMIN"].includes(role));
  }
});
test("expense service scopes reads and writes to the authenticated organization", async () => {
  const filters = [];
  const row = { id: "expense-a", organizationId: "org-a", title: "Hosting", description: null, amount: "12.34", category: "SOFTWARE", vendor: null, notes: null, receiptUrl: null, receiptKey: null, receiptName: null, receiptMime: null, receiptSize: null, date: { toString: () => "2026-10-14T00:00:00Z" }, createdAt: "2026-10-14", updatedAt: "2026-10-14" };
  const model = {
    where(filter) {
      filters.push(filter);
      return {
        async all() { return filter.organizationId === "org-a" ? [row] : []; },
        async first() { return filter.organizationId === "org-a" && filter.id === row.id ? row : null; },
        async update(data) { return filter.organizationId === "org-a" && filter.id === row.id ? { ...row, ...data } : null; },
        async delete() { return row; },
      };
    },
    async create(data) { return { ...row, ...data }; },
  };
  const storage = { async delete() {}, async put() {}, async get() { return Buffer.from("receipt"); } };
  const service = new ExpensesService({ orm: { public: { Expense: model } } }, { auth: { organizationId: "org-a" } }, storage);
  const listed = await service.list({ limit: 20, offset: 0, sort: "date", order: "desc" });
  assert.equal(listed.total, 1);
  assert.equal("receiptKey" in listed.items[0], false);
  assert.deepEqual(filters[0], { organizationId: "org-a" });
  await assert.rejects(service.get("other"), /Expense not found/);
  const created = await service.create({ title: " Travel ", amount: "10.20", category: "TRAVEL", date: "2026-10-14" });
  assert.equal(created.amount, "10.20");
  assert.equal(created.organizationId, "org-a");
});
test("receipt replacement cleans the new object if the database update fails", async () => {
  const deleted = [];
  const row = { id: "expense-a", organizationId: "org-a", title: "Hosting", receiptKey: "old-key", receiptUrl: null };
  const db = { orm: { public: { Expense: { where() { return { async first() { return row; }, async update() { throw new Error("database failed"); } }; } } } } };
  const storage = { async put() {}, async delete(key) { deleted.push(key); } };
  const service = new ExpensesService(db, { auth: { organizationId: "org-a" } }, storage);
  await assert.rejects(service.uploadReceipt("expense-a", { originalname: "receipt.jpg", mimetype: "image/jpeg", size: 4, buffer: Buffer.from([255,216,255,217]) }), /database failed/);
  assert.equal(deleted.length, 1);
  assert.match(deleted[0], /^organizations\/org-a\/expenses\/expense-a\//);
});
