import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { InvoiceExportQueue } from "./invoice-export.queue.js";
import { InvoiceExportStorageService } from "./invoice-export-storage.service.js";
import { InvoiceExportsController } from "./invoice-exports.controller.js";
import { InvoiceExportsService } from "./invoice-exports.service.js";

@Module({
  imports: [StorageModule],
  controllers: [InvoiceExportsController],
  providers: [InvoiceExportQueue, InvoiceExportStorageService, InvoiceExportsService],
})
export class BackgroundJobsModule {}
