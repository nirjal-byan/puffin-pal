import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { InvoicePdfStorageService } from "../dist/src/modules/invoices/pdf/invoice-pdf-storage.service.js";
import { InvoicesService } from "../dist/src/modules/invoices/invoices.service.js";

const pdf = Buffer.from("%PDF-immutable-test");
const organizationId = "org-1";
const invoiceId = "invoice-1";

test("invoice PDFs use tenant-scoped immutable object writes", async () => {
  let written;
  const storage = new InvoicePdfStorageService({
    put: async (...args) => {
      written = args;
    },
  });
  const key = storage.createKey(organizationId, invoiceId);
  assert.match(
    key,
    /^organizations\/org-1\/invoices\/invoice-1\/[0-9a-f-]+\.pdf$/,
  );
  await storage.put(key, pdf, organizationId, invoiceId);
  assert.equal(written[0], key);
  assert.equal(written[1], pdf);
  assert.equal(written[2], "application/pdf");
  assert.equal(written[3].organization, organizationId);
  assert.equal(written[3].invoice, invoiceId);
  assert.equal(
    written[3].sha256,
    createHash("sha256").update(pdf).digest("hex"),
  );
  assert.equal(written[4], true);
});

test("stored invoice PDF integrity and tenant ownership are verified", async () => {
  const metadata = {
    organization: organizationId,
    invoice: invoiceId,
    sha256: createHash("sha256").update(pdf).digest("hex"),
  };
  const storage = new InvoicePdfStorageService({
    get: async () => ({
      buffer: pdf,
      contentType: "application/pdf",
      metadata,
    }),
  });
  const key = `organizations/${organizationId}/invoices/${invoiceId}/file.pdf`;
  assert.equal(await storage.get(key, organizationId, invoiceId), pdf);
  await assert.rejects(
    storage.get(key, "another-tenant", invoiceId),
    ServiceUnavailableException,
  );
  const corrupted = new InvoicePdfStorageService({
    get: async () => ({
      buffer: Buffer.from("not a pdf"),
      contentType: "application/pdf",
      metadata,
    }),
  });
  await assert.rejects(
    corrupted.get(key, organizationId, invoiceId),
    ServiceUnavailableException,
  );
});

test("downloads use stored bytes and historical invoices retain rendering fallback", async () => {
  let pdfKey = `organizations/${organizationId}/invoices/${invoiceId}/stored.pdf`;
  const db = {
    orm: {
      public: {
        Invoice: {
          where: () => ({
            select: () => ({ first: async () => ({ pdfKey }) }),
          }),
        },
      },
    },
  };
  let renders = 0;
  const renderer = {
    render: async () => {
      renders++;
      return Buffer.from("%PDF-fallback");
    },
  };
  const storedPdf = Buffer.from("%PDF-stored-original");
  const storage = {
    get: async () => storedPdf,
  };
  const service = new InvoicesService(
    db,
    { auth: { organizationId, userId: "user-1" } },
    renderer,
    storage,
  );
  let mutableInvoice = { invoiceNumber: "INV-1", totalPaid: "0.00" };
  service.getInvoice = async () => mutableInvoice;
  assert.equal((await service.getInvoicePdf(invoiceId)).buffer, storedPdf);
  mutableInvoice = { invoiceNumber: "INV-1", totalPaid: "100.00" };
  assert.equal((await service.getInvoicePdf(invoiceId)).buffer, storedPdf);
  assert.equal(renders, 0);

  pdfKey = null;
  assert.equal(
    (await service.getInvoicePdf(invoiceId)).buffer.toString(),
    "%PDF-fallback",
  );
  assert.equal(renders, 1);
});

test("storage upload and missing-object failures are explicit 503 errors", async () => {
  const storage = new InvoicePdfStorageService({
    put: async () => {
      throw new Error("upload unavailable");
    },
    get: async () => {
      throw new Error("missing object");
    },
  });
  const key = `organizations/${organizationId}/invoices/${invoiceId}/file.pdf`;
  await assert.rejects(
    storage.put(key, pdf, organizationId, invoiceId),
    ServiceUnavailableException,
  );
  await assert.rejects(
    storage.get(key, organizationId, invoiceId),
    ServiceUnavailableException,
  );
});
