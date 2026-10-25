import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { NestFactory } from "@nestjs/core";
import { Temporal } from "temporal-polyfill";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";
import { InvoiceExportProcessor } from "../dist/src/infrastructure/background-jobs/invoice-export.processor.js";
import { InvoiceExportQueue } from "../dist/src/infrastructure/background-jobs/invoice-export.queue.js";
import { WorkerModule } from "../dist/src/infrastructure/background-jobs/worker.module.js";

test("bulk invoice exports are queued, tenant-scoped, durable, and downloadable", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const api = await createApplication(true);
  await api.listen(0, "127.0.0.1");
  const workerApp = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  const processor = workerApp.get(InvoiceExportProcessor);
  await processor.start();
  const queue = api.get(InvoiceExportQueue);
  const db = api.get(DATABASE);
  const base = `${await api.getUrl()}/api/v1`;
  const password = "Export-test-password-123";
  const temp = await mkdtemp(join(tmpdir(), "puffinpal-export-"));

  async function request(path, token, options = {}, expected = 200) {
    const response = await fetch(base + path, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    assert.equal(response.status, expected, `${path}: ${await response.clone().text()}`);
    return response;
  }
  const json = async (...args) => (await request(...args)).json();
  const signup = (slug) => json("/auth/signup", null, {
    method: "POST",
    body: { organizationName: slug, organizationSlug: slug, fullName: "Owner", email: "owner@export.test", password },
  }, 201);
  async function waitFor(jobId, token) {
    for (let index = 0; index < 80; index++) {
      const status = await json(`/invoices/exports/${jobId}`, token);
      if (["COMPLETED", "FAILED", "EXPIRED"].includes(status.status)) return status;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail("Export did not finish in time");
  }

  try {
    const owner = await signup("export-owner");
    const other = await signup("export-other");
    const token = owner.accessToken;
    const client = await json("/clients", token, {
      method: "POST",
      body: { name: "Export Client", email: "export@client.test" },
    }, 201);
    const create = async (description) => {
      const draft = await json("/invoices", token, {
        method: "POST",
        body: {
          clientId: client.id,
          issueDate: "2026-10-16",
          dueDate: "2026-11-16",
          items: [{ description, quantity: 1, unitPrice: "10.00" }],
        },
      }, 201);
      await json(`/invoices/${draft.id}/issue`, token, {
        method: "POST",
        body: { expectedVersion: 1 },
      });
      return draft;
    };
    const first = await create("Stored PDF");
    const second = await create("Historical PDF");
    await db.orm.public.Invoice.where({
      organizationId: owner.organization.id,
      id: second.id,
    }).updateAll({ pdfKey: null });
    const draft = await json("/invoices", token, {
      method: "POST",
      body: {
        clientId: client.id,
        issueDate: "2026-10-16",
        dueDate: "2026-11-16",
        items: [{ description: "Draft", quantity: 1, unitPrice: "1.00" }],
      },
    }, 201);

    await request("/invoices/exports", token, {
      method: "POST",
      body: { requestId: randomUUID(), invoiceIds: [draft.id] },
    }, 404);
    const requestId = randomUUID();
    const created = await json("/invoices/exports", token, {
      method: "POST",
      body: { requestId, invoiceIds: [first.id, second.id] },
    }, 201);
    assert.equal(created.status, "QUEUED");
    const queuedJob = await queue.queue.getJob(created.jobId);
    assert.equal(queuedJob.opts.attempts, 3);
    assert.deepEqual(queuedJob.opts.backoff, { type: "exponential", delay: 2000 });
    const duplicate = await json("/invoices/exports", token, {
      method: "POST",
      body: { requestId, invoiceIds: [second.id, first.id] },
    }, 201);
    assert.equal(duplicate.jobId, created.jobId);
    await request(`/invoices/exports/${created.jobId}`, other.accessToken, {}, 404);
    await request(`/invoices/exports/${created.jobId}/download`, other.accessToken, {}, 404);

    const completed = await waitFor(created.jobId, token);
    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.progress, 100);
    const download = await request(`/invoices/exports/${created.jobId}/download`, token);
    assert.equal(download.headers.get("content-type"), "application/zip");
    const archive = Buffer.from(await download.arrayBuffer());
    const archivePath = join(temp, "invoices.zip");
    await writeFile(archivePath, archive);
    const listing = spawnSync("unzip", ["-l", archivePath], { encoding: "utf8" });
    assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, new RegExp(`${first.invoiceNumber}\\.pdf`));
    assert.match(listing.stdout, new RegExp(`${second.invoiceNumber}\\.pdf`));

    await queue.enqueue({ exportId: created.jobId, organizationId: owner.organization.id });
    assert.equal((await waitFor(created.jobId, token)).status, "COMPLETED");

    await processor.close();
    const restartRequest = await json("/invoices/exports", token, {
      method: "POST",
      body: { requestId: randomUUID(), invoiceIds: [first.id] },
    }, 201);
    assert.equal(restartRequest.status, "QUEUED");
    await processor.start();
    assert.equal((await waitFor(restartRequest.jobId, token)).status, "COMPLETED");

    await db.orm.public.InvoiceExport.where({
      organizationId: owner.organization.id,
      id: created.jobId,
    }).updateAll({ expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }) });
    assert.equal((await json(`/invoices/exports/${created.jobId}`, token)).status, "EXPIRED");
    await request(`/invoices/exports/${created.jobId}/download`, token, {}, 410);
    await processor.cleanup();
    const expired = await db.orm.public.InvoiceExport.where({ id: created.jobId }).first();
    assert.equal(expired.status, "EXPIRED");
    assert.equal(expired.archiveKey, null);
  } finally {
    await processor.close();
    await workerApp.close();
    await api.close();
    await rm(temp, { recursive: true, force: true });
  }
});
