import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ObjectStorageService } from "../storage/object-storage.service.js";
import type { ReceiptFile } from "./receipt-validation.js";

@Injectable()
export class ReceiptStorageService {
  constructor(private readonly objects: ObjectStorageService) {}
  async put(key: string, file: ReceiptFile) {
    try {
      await this.objects.put(key, file.buffer, file.mimetype, {
        originalname: encodeURIComponent(file.originalname),
      });
    } catch (error) {
      throw new ServiceUnavailableException("Receipt upload failed", { cause: error });
    }
  }
  async get(key: string) {
    try {
      return (await this.objects.get(key)).buffer;
    } catch (error) {
      throw new ServiceUnavailableException("Receipt download failed", { cause: error });
    }
  }
  async delete(key: string) {
    try {
      await this.objects.delete(key);
    } catch (error) {
      throw new ServiceUnavailableException("Receipt cleanup failed", { cause: error });
    }
  }
}
