import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { CreateInvoiceExportDto } from "./invoice-export.dto.js";
import { InvoiceExportsService } from "./invoice-exports.service.js";

@ApiTags("invoice exports")
@ApiBearerAuth()
@Controller("invoices/exports")
export class InvoiceExportsController {
  constructor(private readonly exports: InvoiceExportsService) {}

  @Post()
  @RequirePermissions("invoices:read")
  create(@Body() input: CreateInvoiceExportDto) {
    return this.exports.create(input);
  }

  @Get(":jobId")
  @RequirePermissions("invoices:read")
  status(@Param("jobId", ParseUUIDPipe) jobId: string) {
    return this.exports.get(jobId);
  }

  @Get(":jobId/download")
  @RequirePermissions("invoices:read")
  @Header("Cache-Control", "private, no-store")
  async download(@Param("jobId", ParseUUIDPipe) jobId: string) {
    const file = await this.exports.download(jobId);
    const filename = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new StreamableFile(file.stream, {
      type: "application/zip",
      disposition: `attachment; filename="${filename}"`,
      length: file.contentLength,
    });
  }
}
