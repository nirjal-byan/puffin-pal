import {
  Body,
  HttpCode,
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Header,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { PageDto } from "../tenancy/page.dto.js";
import { CreateInvoiceDto } from "./dto/create-invoice.dto.js";
import {
  UpdateInvoiceDto,
  DeleteInvoiceDto,
} from "./dto/update-invoice.dto.js";
import { IssueInvoiceDto } from "./dto/issue-invoice.dto.js";
import { CreatePaymentDto } from "./dto/create-payment.dto.js";
import { InvoicesService } from "./invoices.service.js";
import { invoicePdfFilename } from "./pdf/invoice-pdf.service.js";
@ApiTags("invoices")
@ApiBearerAuth()
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}
  @Post()
  @RequirePermissions("invoices:create")
  create(@Body() input: CreateInvoiceDto) {
    return this.invoices.createInvoice(input);
  }
  @Get()
  @RequirePermissions("invoices:read")
  list(@Query() page: PageDto) {
    return this.invoices.listInvoices(page);
  }
  @Get(":id")
  @RequirePermissions("invoices:read")
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.getInvoice(id);
  }
  @Get(":id/pdf")
  @RequirePermissions("invoices:read")
  @Header("Cache-Control", "private, no-store")
  async downloadPdf(@Param("id", ParseUUIDPipe) id: string) {
    const { invoice, buffer } = await this.invoices.getInvoicePdf(id);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${invoicePdfFilename(invoice.invoiceNumber)}"`,
      length: buffer.length,
    });
  }
  @Post(":id/issue")
  @HttpCode(200)
  @RequirePermissions("invoices:issue")
  issue(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: IssueInvoiceDto,
  ) {
    return this.invoices.issueInvoice(id, input.expectedVersion);
  }
  @Post(":id/payments")
  @RequirePermissions("invoices:record-payment")
  recordPayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CreatePaymentDto,
  ) {
    return this.invoices.recordPayment(id, input);
  }
  @Patch(":id")
  @RequirePermissions("invoices:update")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateInvoiceDto,
  ) {
    return this.invoices.updateInvoice(id, input);
  }
  @Delete(":id")
  @RequirePermissions("invoices:delete")
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: DeleteInvoiceDto,
  ) {
    return this.invoices.deleteInvoice(id, input.expectedVersion);
  }
  @Get(":invoiceId/items")
  @RequirePermissions("invoices:read")
  items(@Param("invoiceId", ParseUUIDPipe) id: string, @Query() page: PageDto) {
    return this.invoices.listInvoiceItems(id, page);
  }
}
