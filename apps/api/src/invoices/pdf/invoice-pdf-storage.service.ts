import { createHash, randomUUID } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ObjectStorageService } from "../../storage/object-storage.service.js";

@Injectable()
export class InvoicePdfStorageService {
  constructor(private readonly objects: ObjectStorageService) {}

  createKey(organizationId: string, invoiceId: string) {
    return `organizations/${organizationId}/invoices/${invoiceId}/${randomUUID()}.pdf`;
  }

  async put(key: string, buffer: Buffer, organizationId: string, invoiceId: string) {
    try {
      await this.objects.put(
        key,
        buffer,
        "application/pdf",
        {
          organization: organizationId,
          invoice: invoiceId,
          sha256: createHash("sha256").update(buffer).digest("hex"),
        },
        true,
      );
    } catch (error) {
      throw new ServiceUnavailableException("Invoice PDF upload failed", {
        cause: error,
      });
    }
  }

  async get(key: string, organizationId: string, invoiceId: string) {
    const expectedPrefix = `organizations/${organizationId}/invoices/${invoiceId}/`;
    if (!key.startsWith(expectedPrefix))
      throw new ServiceUnavailableException("Stored invoice PDF is invalid");
    try {
      const stored = await this.objects.get(key);
      const digest = createHash("sha256").update(stored.buffer).digest("hex");
      if (
        stored.contentType !== "application/pdf" ||
        stored.buffer.subarray(0, 5).toString() !== "%PDF-" ||
        !stored.metadata.sha256 ||
        stored.metadata.sha256 !== digest ||
        stored.metadata.organization !== organizationId ||
        stored.metadata.invoice !== invoiceId
      )
        throw new Error("Invoice PDF integrity validation failed");
      return stored.buffer;
    } catch (error) {
      throw new ServiceUnavailableException("Invoice PDF download failed", {
        cause: error,
      });
    }
  }

  async delete(key: string) {
    try {
      await this.objects.delete(key);
    } catch (error) {
      throw new ServiceUnavailableException("Invoice PDF cleanup failed", {
        cause: error,
      });
    }
  }
}
