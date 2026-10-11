import {
  Body,
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { PageDto } from "../tenancy/page.dto.js";
import { CreateInvoiceDto } from "./dto/create-invoice.dto.js";
import {
  UpdateInvoiceDto,
  DeleteInvoiceDto,
} from "./dto/update-invoice.dto.js";
import { InvoicesService } from "./invoices.service.js";
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
