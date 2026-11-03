import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createHookHarness } from "./helpers/hook-harness.mjs";
import {
  archiveVendor,
  billValues,
  canChangeAttachment,
  canEditBill,
  downloadBillAttachment,
  emptyBill,
  emptyVendor,
  removeBillAttachment,
  saveBill,
  saveVendor,
  uploadBillAttachment,
  validateAttachment,
  validateBill,
  vendorValues,
} from "../src/features/accounts-payable/services/payables-api.ts";
const { usePayableAction } =
  await import("../src/features/accounts-payable/hooks/use-payable-action.ts");

const vendor = {
  ...emptyVendor(),
  id: "vendor-1",
  name: "Supplier",
  email: "supplier@example.com",
  phone: "123",
  notes: "Keep these notes",
  version: 7,
  active: true,
};
const bill = {
  ...emptyBill(),
  id: "bill-1",
  vendorId: vendor.id,
  vendor,
  billNumber: "B-100",
  status: "DRAFT",
  version: 4,
  issueDate: "2026-11-01T00:00:00Z",
  dueDate: "2026-11-30T00:00:00Z",
  expenseId: "expense-1",
  vendorReference: "REF-20",
  items: [
    {
      position: 1,
      description: "Second",
      quantity: "2.5000",
      unitPrice: "20.00",
      taxAmount: "3.00",
      discountAmount: "1.00",
    },
    {
      position: 0,
      description: "First",
      quantity: "1.0000",
      unitPrice: "10.00",
      taxAmount: "0.00",
      discountAmount: "0.00",
    },
  ],
};

test("vendor edits preserve contact fields, custom terms and concurrency version", async () => {
  let call;
  const api = async (...args) => {
    call = args;
  };
  const value = vendorValues({
    ...vendor,
    paymentTermsDays: 42,
    defaultCurrency: "JPY",
    displayName: null,
  });
  assert.equal(value.displayName, "");
  await saveVendor(api, value, vendor);
  assert.deepEqual(call, [
    "/vendors/vendor-1",
    { method: "PATCH", body: { ...value, expectedVersion: 7 } },
  ]);
  assert.equal(call[1].body.notes, vendor.notes);
  await saveVendor(api, value);
  assert.equal(call[0], "/vendors");
  assert.equal(call[1].method, "POST");
  assert.equal(call[1].body.expectedVersion, undefined);
});

test("invalid vendor updates make no request and server conflicts propagate", async () => {
  let count = 0;
  const api = async () => {
    count++;
    throw new Error("Vendor changed. Reload and try again.");
  };
  for (const patch of [
    { name: " " },
    { paymentTermsDays: -1 },
    { paymentTermsDays: 1.5 },
    { paymentTermsDays: 366 },
    { email: "bad" },
  ]) {
    assert.throws(() => saveVendor(api, { ...vendorValues(vendor), ...patch }, vendor));
  }
  assert.equal(count, 0);
  await assert.rejects(saveVendor(api, vendorValues(vendor), vendor), /Vendor changed/);
});

test("archive uses the existing non-destructive action and preserves business errors", async () => {
  let call;
  await archiveVendor(async (...args) => {
    call = args;
  }, vendor.id);
  assert.deepEqual(call, ["/vendors/vendor-1/archive", { method: "POST" }]);
  await assert.rejects(
    archiveVendor(async () => {
      throw new Error("A vendor with an outstanding balance cannot be archived");
    }, vendor.id),
    /outstanding balance/,
  );
});

test("bill edit preserves all lines in order, expense link, reference, and version", async () => {
  let call;
  const value = billValues(bill);
  assert.equal(value.issueDate, "2026-11-01");
  assert.equal(value.items[0].description, "First");
  assert.equal(value.items[1].discountAmount, "1.00");
  assert.equal(validateBill(value), "");
  await saveBill(
    async (...args) => {
      call = args;
    },
    value,
    bill,
  );
  assert.deepEqual(call, [
    "/accounts-payable/bills/bill-1",
    { method: "PATCH", body: { ...value, expectedVersion: 4 } },
  ]);
  assert.equal(call[1].body.expenseId, "expense-1");
  assert.equal(call[1].body.vendorReference, "REF-20");
  assert.equal(bill.items[0].description, "Second", "mapping must not mutate fetched detail");
});

test("only drafts can be edited and stale-version errors preserve the entered form", async () => {
  const value = billValues(bill);
  for (const status of ["REJECTED", "PENDING_APPROVAL", "APPROVED", "VOIDED"]) {
    assert.equal(canEditBill(status), false);
    assert.throws(
      () => saveBill(() => assert.fail("must not request"), value, { ...bill, status }),
      /Only draft/,
    );
  }
  assert.equal(canEditBill("DRAFT"), true);
  const before = structuredClone(value);
  await assert.rejects(
    saveBill(
      async () => {
        throw new Error("Bill changed. Reload and try again.");
      },
      value,
      bill,
    ),
    /Bill changed/,
  );
  assert.deepEqual(value, before);
});

test("bill validation catches missing lines, dates, descriptions, amounts and excessive discounts", () => {
  const value = billValues(bill);
  for (const patch of [
    { vendorId: "" },
    { billNumber: " " },
    { dueDate: "2026-01-01" },
    { issueDate: "" },
    { dueDate: "2026-02-30" },
    { dueDate: "2026-99-01" },
    { items: [] },
  ]) {
    assert.notEqual(validateBill({ ...value, ...patch }), "");
  }
  for (const patch of [
    { description: " " },
    { quantity: "NaN" },
    { quantity: "1.12345" },
    { unitPrice: "-1" },
    { taxAmount: "0.001" },
    { discountAmount: "999999.00" },
  ]) {
    assert.notEqual(validateBill({ ...value, items: [{ ...value.items[0], ...patch }] }), "");
  }
});

test("attachment upload uses authenticated multipart API and enforces type, size and lifecycle", async () => {
  const file = new File(["%PDF-test"], "supplier.pdf", { type: "application/pdf" });
  let call;
  await uploadBillAttachment(
    async (...args) => {
      call = args;
    },
    bill,
    file,
  );
  assert.equal(call[0], "/accounts-payable/bills/bill-1/attachment");
  assert.equal(call[1].method, "PUT");
  assert.equal(call[1].body.get("attachment").name, "supplier.pdf");
  assert.equal(await call[1].body.get("attachment").text(), "%PDF-test");
  for (const bad of [
    { size: 1, type: "text/html" },
    { size: 5 * 1024 * 1024 + 1, type: "application/pdf" },
    { size: 0, type: "image/png" },
  ]) {
    assert.notEqual(validateAttachment(bad), "");
    await assert.rejects(uploadBillAttachment(() => assert.fail("must not upload"), bill, bad));
  }
  assert.equal(validateAttachment({ size: 5 * 1024 * 1024, type: "image/webp" }), "");
  for (const status of ["APPROVED", "PENDING_APPROVAL", "VOIDED"]) {
    assert.equal(canChangeAttachment(status), false);
    await assert.rejects(
      uploadBillAttachment(() => assert.fail("must not upload"), { ...bill, status }, file),
    );
    assert.throws(() =>
      removeBillAttachment(() => assert.fail("must not remove"), { ...bill, status }),
    );
  }
  assert.equal(canChangeAttachment("REJECTED"), true);
});

test("attachment download/removal use bill-scoped endpoints and failures propagate", async () => {
  const calls = [];
  const api = async (...args) => {
    calls.push(args);
    return new Blob(["private"]);
  };
  assert.equal(await (await downloadBillAttachment(api, bill.id)).text(), "private");
  await removeBillAttachment(api, bill);
  assert.deepEqual(calls, [
    ["/accounts-payable/bills/bill-1/attachment", { responseType: "file" }],
    ["/accounts-payable/bills/bill-1/attachment", { method: "DELETE" }],
  ]);
  const denied = async () => {
    throw new Error("Forbidden");
  };
  await assert.rejects(downloadBillAttachment(denied, bill.id), /Forbidden/);
  await assert.rejects(
    uploadBillAttachment(denied, bill, new File(["x"], "x.png", { type: "image/png" })),
    /Forbidden/,
  );
});

test("mutation hook prevents duplicate submissions and displays failures without success callbacks", async () => {
  const harness = createHookHarness(usePayableAction);
  let action = harness.render();
  let release;
  let count = 0;
  const pending = action.run(async () => {
    count++;
    await new Promise((resolve) => {
      release = resolve;
    });
    throw new Error("Upload failed");
  });
  await action.run(async () => {
    count++;
  });
  assert.equal(count, 1);
  assert.equal(harness.render().busy, true);
  release();
  await pending;
  action = harness.render();
  assert.equal(action.busy, false);
  assert.equal(action.error, "Upload failed");
  await action.run(async () => {
    count++;
  });
  assert.equal(harness.render().error, "");
  assert.equal(count, 2);
  harness.unmount();
});

test("UI gates vendor and bill actions separately and requires archive/removal confirmation", async () => {
  const read = (path) =>
    readFile(new URL(`../src/features/accounts-payable/${path}`, import.meta.url), "utf8");
  const [page, vendors, bills, archive, attachments] = await Promise.all([
    read("components/accounts-payable-page.tsx"),
    read("components/vendor-grid.tsx"),
    read("components/bills-table.tsx"),
    read("dialogs/archive-vendor-dialog.tsx"),
    read("dialogs/bill-attachments-dialog.tsx"),
  ]);
  assert.match(page, /canManageVendors = permissions.includes\("vendors:manage"\)/);
  assert.match(page, /canManage = permissions.includes\("accounts-payable:manage"\)/);
  assert.match(vendors, /canManage &&/);
  assert.match(vendors, /vendor.active &&/);
  assert.match(bills, /bill.status === "DRAFT" && canManage/);
  assert.match(archive, /onSubmit=\{\(\) =>/);
  assert.match(archive, /Existing bills and financial history\s+remain available/);
  assert.match(attachments, /canManage && canChangeAttachment\(bill.status\)/);
  assert.match(attachments, /Confirm removal/);
  assert.match(attachments, /setBill\(await api<VendorBillDetail>/);
});

test("saving forms prevent modal dismissal until the mutation completes", async () => {
  const read = (name) =>
    readFile(new URL(`../src/components/ui/${name}.tsx`, import.meta.url), "utf8");
  const [modal, form] = await Promise.all([read("app-modal"), read("form-modal")]);
  assert.match(modal, /if \(closing \|\| !dismissible\) return/);
  assert.match(form, /dismissible=\{!submitting\}/);
  assert.match(form, /disabled=\{submitting\}/);
});
