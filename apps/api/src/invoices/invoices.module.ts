import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { InvoicePdfService } from "./pdf/invoice-pdf.service.js";
@Module({ controllers: [InvoicesController], providers: [InvoicesService, InvoicePdfService] })
export class InvoicesModule {}
