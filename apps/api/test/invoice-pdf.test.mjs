import "reflect-metadata";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InvoicePdfService, invoicePdfFilename } from "../dist/src/invoices/pdf/invoice-pdf.service.js";
import { InvoicesController } from "../dist/src/invoices/invoices.controller.js";
import { PermissionsGuard } from "../dist/src/auth/permissions.guard.js";
import { REQUIRED_PERMISSIONS } from "../dist/src/auth/auth.decorators.js";

const fixture = () => ({
  status: "ISSUED", invoiceNumber: "INV-PDF-123", issuedAt: "2026-10-12T10:00:00Z",
  issueDate: "2026-10-10T00:00:00Z", dueDate: "2026-11-10T00:00:00Z",
  sellerName: "Original Seller", currency: "USD", billingName: "José Client",
  billingEmail: "original@client.test", billingCompanyName: "Original Company",
  billingTaxId: "TAX-123", notes: "Thank you for your business.",
  subtotal: "9999999999.99", tax: "0.00", total: "9999999999.99",
  items: [{ description: "Consulting services", quantity: 1, unitPrice: "9999999999.99", amount: "9999999999.99" }],
  client: { name: "Changed live client", email: "changed@client.test" },
});
function extract(t, buffer) {
  const result = spawnSync("pdftotext", ["-layout", "-", "-"], { input: buffer });
  if (result.error?.code === "ENOENT") {
    t.skip("PDF text extraction requires the optional Poppler pdftotext utility");
    return null;
  }
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout.toString();
}
test("PDF contains finalized billing, dates and exact monetary values", async (t) => {
  const invoice = fixture();
  const buffer = await new InvoicePdfService().render(invoice);
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  const text = extract(t, buffer);
  if (text === null) return;
  for (const value of ["PuffinPal", invoice.invoiceNumber, "2026-10-12", "2026-10-10", "2026-11-10",
    invoice.sellerName, invoice.billingName, invoice.billingEmail, invoice.billingCompanyName,
    invoice.billingTaxId, "Consulting services", "Subtotal", "Tax", "Total", "USD 9999999999.99", "USD 0.00", invoice.notes])
    assert.ok(text.includes(value), `Missing ${value}`);
  assert.ok(!text.includes("Changed live client"));
  assert.ok(!text.includes("changed@client.test"));
  assert.match(text, /Page 1 of 1/);
});
test("long invoices paginate without losing rows, notes or totals", async (t) => {
  const invoice = fixture();
  invoice.items = Array.from({ length: 100 }, (_, index) => ({
    description: `Item ${index + 1} ` + (index === 0 ? "Long description\n".repeat(55) : "Consulting ".repeat(20)),
    quantity: 2147483647, unitPrice: "0.00", amount: "0.00",
  }));
  invoice.notes = "Long note\n".repeat(400) + "Final note marker";
  const text = extract(t, await new InvoicePdfService().render(invoice));
  if (text === null) return;
  for (let index = 1; index <= 100; index++) assert.ok(text.includes(`Item ${index}`));
  assert.ok(text.includes("2147483647"));
  assert.ok(text.includes("Final note marker"));
  assert.ok(text.includes("USD 9999999999.99"));
  assert.ok(text.split("\f").length > 5);
});
test("PDF rendering rejects every non-issued status and incomplete snapshots", async () => {
  const renderer = new InvoicePdfService();
  for (const status of ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"])
    await assert.rejects(renderer.render({ ...fixture(), status }), ConflictException);
  for (const key of ["issuedAt", "sellerName", "currency", "billingName", "billingEmail"])
    await assert.rejects(renderer.render({ ...fixture(), [key]: null }), ConflictException);
});
test("PDF route requires read permission and safe attachment filenames", () => {
  const handler = InvoicesController.prototype.downloadPdf;
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, handler), ["invoices:read"]);
  const guard = new PermissionsGuard(new Reflector());
  assert.throws(() => guard.canActivate({
    getHandler: () => handler, getClass: () => InvoicesController,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }), ForbiddenException);
  for (const role of ["OWNER", "ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]) {
    assert.equal(guard.canActivate({
      getHandler: () => handler, getClass: () => InvoicesController,
      switchToHttp: () => ({ getRequest: () => ({ auth: { role } }) }),
    }), true);
  }
  assert.equal(invoicePdfFilename('bad/"\r\n.pdf'), "bad____.pdf.pdf");
});
