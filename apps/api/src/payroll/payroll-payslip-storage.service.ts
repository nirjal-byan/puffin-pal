import { createHash, randomUUID } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ObjectStorageService } from "../storage/object-storage.service.js";

@Injectable()
export class PayrollPayslipStorageService {
  constructor(private readonly objects: ObjectStorageService) {}
  createKey(organizationId: string, payrollRunId: string, entryId: string) {
    return `organizations/${organizationId}/payroll/${payrollRunId}/${entryId}/${randomUUID()}.pdf`;
  }
  async put(
    key: string,
    buffer: Buffer,
    organizationId: string,
    payrollRunId: string,
    entryId: string,
  ) {
    try {
      await this.objects.put(
        key,
        buffer,
        "application/pdf",
        {
          organization: organizationId,
          payrollrun: payrollRunId,
          entry: entryId,
          sha256: createHash("sha256").update(buffer).digest("hex"),
        },
        true,
      );
    } catch (error) {
      throw new ServiceUnavailableException("Payslip upload failed", { cause: error });
    }
  }
  async get(key: string, organizationId: string, payrollRunId: string, entryId: string) {
    if (!key.startsWith(`organizations/${organizationId}/payroll/${payrollRunId}/${entryId}/`))
      throw new ServiceUnavailableException("Stored payslip is invalid");
    try {
      const object = await this.objects.get(key);
      const digest = createHash("sha256").update(object.buffer).digest("hex");
      if (
        object.contentType !== "application/pdf" ||
        object.buffer.subarray(0, 5).toString() !== "%PDF-" ||
        object.metadata.organization !== organizationId ||
        object.metadata.payrollrun !== payrollRunId ||
        object.metadata.entry !== entryId ||
        object.metadata.sha256 !== digest
      )
        throw new Error("Payslip integrity validation failed");
      return object.buffer;
    } catch (error) {
      throw new ServiceUnavailableException("Payslip download failed", { cause: error });
    }
  }
  delete(key: string) {
    return this.objects.delete(key);
  }
}
