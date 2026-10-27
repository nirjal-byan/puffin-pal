import assert from "node:assert/strict";
import { test } from "node:test";
import { filterAndSortBills, filterVendors } from "../src/features/accounts-payable/utils.ts";
import { cashFlowChartData, cashFlowSourceLabel } from "../src/features/cash-flow/utils.ts";

test("accounts payable helpers filter and sort without mutating API concerns", () => {
  const bills = [
    {
      id: "2",
      vendorId: "v2",
      billNumber: "B-2",
      dueDate: "2026-12-01",
      balance: "25",
      status: "APPROVED",
    },
    {
      id: "1",
      vendorId: "v1",
      billNumber: "A-1",
      dueDate: "2026-11-01",
      balance: "100",
      status: "DRAFT",
    },
  ];
  const names = new Map([
    ["v1", "Acme"],
    ["v2", "Beta"],
  ]);
  assert.deepEqual(
    filterAndSortBills(bills, names, "acme", "ALL", "DUE_ASC").map((item) => item.id),
    ["1"],
  );
  assert.deepEqual(
    filterAndSortBills(bills, names, "", "ALL", "BALANCE_DESC").map((item) => item.id),
    ["1", "2"],
  );
  assert.equal(filterVendors([{ name: "Acme", displayName: null, email: null }], "acm").length, 1);
});

test("cash flow helpers create display labels and numeric chart values", () => {
  assert.equal(cashFlowSourceLabel("RECURRING_INVOICE"), "Recurring Invoice");
  assert.deepEqual(
    cashFlowChartData([
      { date: "2026-10-27", inflows: "10.50", outflows: "2.25", closingBalance: null },
    ]),
    [{ date: "2026-10-27", inflows: 10.5, outflows: 2.25, closingBalance: undefined }],
  );
});
