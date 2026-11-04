import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  PayablesQueryDto,
  DetailQueryDto,
} from "../dist/src/modules/accounts-payable/accounts-payable.dto.js";
import { ExpenseQueryDto } from "../dist/src/modules/expenses/expense.dto.js";
import {
  vendorPage,
  billPage,
  paymentPage,
  expensePage,
  validateRange,
} from "../dist/src/modules/accounts-payable/payables-queries.js";

test("pagination defaults are bounded and invalid sizes, offsets, sorts, dates and filters fail", async () => {
  const defaults = plainToInstance(PayablesQueryDto, {});
  assert.equal(defaults.limit, 50);
  assert.equal(defaults.offset, 0);
  for (const value of [
    { limit: 0 },
    { limit: 101 },
    { offset: -1 },
    { offset: 1000001 },
    { sort: "drop table" },
    { order: "sideways" },
    { status: "BAD" },
    { settlementStatus: "BAD" },
    { from: "2026-02-30" },
    { method: "WIRE" },
    { paginated: "maybe" },
    { search: "x".repeat(161) },
  ])
    assert.ok(
      (await validate(plainToInstance(PayablesQueryDto, value))).length,
      JSON.stringify(value),
    );
  assert.equal(
    (
      await validate(
        plainToInstance(PayablesQueryDto, {
          limit: "10",
          offset: "20",
          paginated: "true",
          from: "2026-11-01",
          to: "2026-11-30",
          sort: "dueDate",
          order: "desc",
        }),
      )
    ).length,
    0,
  );
  assert.equal(plainToInstance(DetailQueryDto, { includeHistory: "false" }).includeHistory, false);
  assert.ok((await validate(plainToInstance(ExpenseQueryDto, { settlementStatus: "BAD" }))).length);
  assert.throws(() => validateRange("2026-12-01", "2026-11-01"), /From date/);
});

test("endpoint sort allowlists reject irrelevant fields before executing any query", () => {
  const db = {};
  const q = { limit: 20, offset: 0 };
  assert.throws(() => vendorPage(db, "org-a", { ...q, sort: "balance" }), /Unsupported sort/);
  assert.throws(
    () => billPage(db, "org-a", "2026-11-04", { ...q, sort: "name" }),
    /Unsupported sort/,
  );
  assert.throws(
    () => paymentPage(db, "org-a", "EXPENSE", "e1", { ...q, sort: "issueDate" }),
    /Unsupported sort/,
  );
});

test("query parameters remain bound values and all financial pages use tenant scope and database limits", async () => {
  const plans = [];
  const db = {
    raw: {
      sql(strings, ...values) {
        return {
          returnsRow() {
            return this;
          },
          build() {
            return { strings, values };
          },
        };
      },
    },
    runtime() {
      return {
        async query(plan) {
          plans.push(plan);
          return [{ payload: JSON.stringify({ items: [], total: 0, offset: 20, limit: 10 }) }];
        },
      };
    },
  };
  const search = "%' OR 1=1 --";
  await vendorPage(db, "org-a", { search, limit: 10, offset: 20 });
  await billPage(db, "org-a", "2026-11-04", { search, limit: 10, offset: 20 });
  await expensePage(db, "org-a", { search, limit: 10, offset: 20, sort: "date", order: "desc" });
  await paymentPage(db, "org-a", "VENDOR_BILL", "bill-a", { limit: 10, offset: 20 });
  for (const plan of plans) {
    const sql = plan.strings.join("?");
    assert.ok(plan.values.includes("org-a"));
    assert.match(sql, /LIMIT/);
    assert.match(sql, /OFFSET/);
    assert.ok(!sql.includes(search));
  }
  assert.ok(plans[0].values.includes(search));
});
