import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { InvoicePdfService } from "./pdf/invoice-pdf.service.js";
import { InvoicePdfStorageService } from "./pdf/invoice-pdf-storage.service.js";
import { StorageModule } from "../storage/storage.module.js";
@Module({ imports: [StorageModule], controllers: [InvoicesController], providers: [InvoicesService, InvoicePdfService, InvoicePdfStorageService] })
export class InvoicesModule {}
