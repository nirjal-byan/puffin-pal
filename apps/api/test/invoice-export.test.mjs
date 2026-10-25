import "reflect-metadata";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { InvoiceExportStorageService } from "../dist/src/infrastructure/background-jobs/invoice-export-storage.service.js";
import { InvoicePdfResolverService } from "../dist/src/modules/invoices/pdf/invoice-pdf-resolver.service.js";

test("export storage uses immutable tenant-scoped streaming uploads", async () => {
  let call;
  const storage = new InvoiceExportStorageService({
    putStream: async (...args) => { call = args; },
  });
  const key = storage.key("org-1", "export-1");
  const stream = Readable.from("zip");
  await storage.put(key, stream, "org-1", "export-1");
  assert.equal(key, "organizations/org-1/invoice-exports/export-1/invoices.zip");
  assert.equal(call[0], key);
  assert.equal(call[1], stream);
  assert.equal(call[2], "application/zip");
  assert.deepEqual(call[3], { organization: "org-1", export: "export-1" });
  assert.equal(call[4], true);
});

test("export storage failures and ownership metadata failures are explicit", async () => {
  const failing = new InvoiceExportStorageService({
    putStream: async () => { throw new Error("S3 unavailable"); },
    getStream: async () => { throw new Error("missing"); },
  });
  const key = failing.key("org-1", "export-1");
  await assert.rejects(
    failing.put(key, Readable.from("zip"), "org-1", "export-1"),
    ServiceUnavailableException,
  );
  await assert.rejects(
    failing.download(key, "org-1", "export-1"),
    ServiceUnavailableException,
  );

  const mismatched = new InvoiceExportStorageService({
    getStream: async () => ({
      stream: Readable.from("zip"),
      contentType: "application/zip",
      metadata: { organization: "other", export: "export-1" },
    }),
  });
  await assert.rejects(
    mismatched.download(key, "org-1", "export-1"),
    ServiceUnavailableException,
  );
});

test("PDF resolver reuses immutable documents and renders historical snapshots", async () => {
  let invoice = {
    id: "invoice-1",
    organizationId: "org-1",
    invoiceNumber: "INV-1",
    status: "ISSUED",
    issuedAt: "2026-10-16T00:00:00Z",
    pdfKey: "stored-key",
  };
  const items = [{ description: "Work", quantity: 1, unitPrice: "1.00", amount: "1.00" }];
  const db = { orm: { public: {
    Invoice: { where: () => ({ first: async () => invoice }) },
    InvoiceItem: { where: () => ({ orderBy() { return this; }, all: async () => items }) },
  } } };
  let renders = 0;
  let reads = 0;
  const resolver = new InvoicePdfResolverService(
    db,
    { render: async () => { renders++; return Buffer.from("historical"); } },
    { get: async () => { reads++; return Buffer.from("stored"); } },
  );
  assert.equal((await resolver.resolve("org-1", "invoice-1")).buffer.toString(), "stored");
  assert.equal(reads, 1);
  assert.equal(renders, 0);
  invoice = { ...invoice, pdfKey: null };
  assert.equal((await resolver.resolve("org-1", "invoice-1")).buffer.toString(), "historical");
  assert.equal(renders, 1);
});
