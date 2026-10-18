import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Readable } from "node:stream";
import { ObjectStorageService } from "../storage/object-storage.service.js";

@Injectable()
export class InvoiceExportStorageService {
  constructor(private readonly objects: ObjectStorageService) {}

  key(organizationId: string, exportId: string) {
    return `organizations/${organizationId}/invoice-exports/${exportId}/invoices.zip`;
  }

  private validate(
    key: string,
    organizationId: string,
    exportId: string,
    stored: {
      contentType?: string;
      metadata: Record<string, string>;
    },
  ) {
    if (
      key !== this.key(organizationId, exportId) ||
      stored.contentType !== "application/zip" ||
      stored.metadata.organization !== organizationId ||
      stored.metadata.export !== exportId
    )
      throw new Error("Invoice export object metadata is invalid");
  }

  async put(key: string, stream: Readable, organizationId: string, exportId: string) {
    try {
      await this.objects.putStream(
        key,
        stream,
        "application/zip",
        { organization: organizationId, export: exportId },
        true,
      );
    } catch (error) {
      throw new ServiceUnavailableException("Invoice export upload failed", {
        cause: error,
      });
    }
  }

  async exists(key: string, organizationId: string, exportId: string) {
    try {
      const stored = await this.objects.head(key);
      this.validate(key, organizationId, exportId, stored);
      return { size: Number(stored.contentLength ?? 0) };
    } catch {
      return null;
    }
  }

  async download(key: string, organizationId: string, exportId: string) {
    try {
      const stored = await this.objects.getStream(key);
      this.validate(key, organizationId, exportId, stored);
      return stored;
    } catch (error) {
      throw new ServiceUnavailableException("Invoice export download failed", {
        cause: error,
      });
    }
  }

  async delete(key: string) {
    try {
      await this.objects.delete(key);
    } catch (error) {
      throw new ServiceUnavailableException("Invoice export cleanup failed", {
        cause: error,
      });
    }
  }
}
