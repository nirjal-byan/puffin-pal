import assert from "node:assert/strict";
import { test } from "node:test";
import { createHookHarness, flushPromises } from "./helpers/hook-harness.mjs";
const { usePagedRecords } =
  await import("../src/features/accounts-payable/hooks/use-paged-records.ts");

test("page, page size, filters and sorting drive bounded server requests", async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    const q = new URL(path, "http://local").searchParams;
    return {
      items: [{ id: `row-${q.get("offset")}` }],
      total: 105,
      limit: Number(q.get("limit")),
      offset: Number(q.get("offset")),
    };
  };
  const h = createHookHarness(usePagedRecords, api, "/vendors", { sort: "name", order: "asc" });
  h.render();
  await flushPromises();
  let r = h.render();
  assert.equal(r.page.total, 105);
  assert.ok(calls[0].includes("limit=20"));
  r.setOffset(100);
  h.render();
  await flushPromises();
  r = h.render();
  assert.equal(r.page.items[0].id, "row-100");
  r.setLimit(10);
  h.render();
  await flushPromises();
  r = h.render();
  assert.equal(r.offset, 0);
  assert.equal(r.limit, 10);
  r.setFilters({ search: "Vendor", active: "false", sort: "createdAt", order: "desc" });
  h.render();
  await flushPromises();
  r = h.render();
  r.setOffset(10);
  h.render();
  await flushPromises();
  r = h.render();
  const last = new URL(calls.at(-1), "http://local").searchParams;
  assert.equal(last.get("search"), "Vendor");
  assert.equal(last.get("active"), "false");
  assert.equal(last.get("offset"), "10");
  assert.equal(last.get("sort"), "createdAt");
  assert.equal(last.get("order"), "desc");
  h.unmount();
});

test("late and aborted filter requests cannot overwrite new results", async () => {
  const calls = [];
  const api = (path, options) =>
    new Promise((resolve) => calls.push({ path, signal: options.signal, resolve }));
  const h = createHookHarness(usePagedRecords, api, "/accounts-payable/bills", { sort: "dueDate" });
  h.render();
  await flushPromises();
  h.render().setFilters({ search: "new", sort: "balance", order: "desc" });
  h.render();
  await flushPromises();
  assert.equal(calls[0].signal.aborted, true);
  calls[1].resolve({ items: [{ id: "new" }], total: 1, limit: 20, offset: 0 });
  await flushPromises();
  calls[0].resolve({ items: [{ id: "old" }], total: 100, limit: 20, offset: 0 });
  await flushPromises();
  assert.equal(h.render().page.items[0].id, "new");
  h.unmount();
  assert.equal(calls[1].signal.aborted, true);
});

test("failed pages preserve previous rows, expose retry and recover without resetting filters", async () => {
  let failed = false;
  const api = async () => {
    if (failed) throw new Error("Offline");
    return { items: [{ id: "kept" }], total: 30, limit: 20, offset: 0 };
  };
  const h = createHookHarness(usePagedRecords, api, "/vendors", { active: "true" });
  h.render();
  await flushPromises();
  failed = true;
  const pending = h.render().reload();
  assert.equal(h.render().loading, true);
  await pending;
  assert.equal(h.render().error, "Offline");
  assert.equal(h.render().page.items[0].id, "kept");
  failed = false;
  await h.render().reload();
  assert.equal(h.render().error, "");
  assert.equal(h.render().filters.active, "true");
  h.unmount();
});

test("archive or status mutation on the last page corrects to the last existing server page", async () => {
  let total = 41;
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    const q = new URL(path, "http://local").searchParams;
    const offset = Number(q.get("offset")),
      limit = Number(q.get("limit"));
    return { items: offset < total ? [{ id: `row-${offset}` }] : [], total, offset, limit };
  };
  const h = createHookHarness(usePagedRecords, api, "/vendors", { active: "true" });
  h.render();
  await flushPromises();
  h.render().setOffset(40);
  h.render();
  await flushPromises();
  total = 40;
  await h.render().reload();
  h.render();
  await flushPromises();
  assert.equal(h.render().offset, 20);
  assert.equal(h.render().page.items[0].id, "row-20");
  assert.ok(calls.at(-1).includes("active=true"));
  h.unmount();
});

test("payment pages retain reversal metadata across chronological pages and filters", async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    const q = new URL(path, "http://local").searchParams;
    return {
      items: [
        {
          id: `p-${q.get("offset")}`,
          amount: "0.10",
          reversedAt: "2026-11-04",
          reversalReason: "Correction",
        },
      ],
      total: 25,
      limit: 20,
      offset: Number(q.get("offset")),
    };
  };
  const h = createHookHarness(usePagedRecords, api, "/expenses/e1/payments", {
    paginated: "true",
    order: "desc",
    reversalState: "REVERSED",
    method: "CASH",
  });
  h.render();
  await flushPromises();
  h.render().setOffset(20);
  h.render();
  await flushPromises();
  const r = h.render();
  assert.equal(r.page.items[0].reversalReason, "Correction");
  assert.equal(r.page.items[0].amount, "0.10");
  assert.ok(calls.at(-1).includes("reversalState=REVERSED"));
  assert.ok(calls.at(-1).includes("paginated=true"));
  h.unmount();
});

test("inactive views do not request unrelated financial data", async () => {
  let count = 0;
  const h = createHookHarness(
    usePagedRecords,
    async () => {
      count++;
    },
    "/vendors",
    {},
    false,
  );
  h.render();
  await flushPromises();
  assert.equal(count, 0);
  h.unmount();
});
