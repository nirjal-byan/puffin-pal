import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import { PageDto } from "../tenancy/page.dto.js";
import {
  CreateRecurringInvoiceDto,
  RecurringTransitionDto,
  UpdateRecurringInvoiceDto,
} from "./recurring-invoice.dto.js";
import { RecurringInvoicesService } from "./recurring-invoices.service.js";

@Controller("recurring-invoices")
export class RecurringInvoicesController {
  constructor(private readonly recurring: RecurringInvoicesService) {}
  @Get() @RequirePermissions("retainers:read") list(@Query() page: PageDto) {
    return this.recurring.list(page);
  }
  @Get(":id") @RequirePermissions("retainers:read") get(@Param("id", ParseUUIDPipe) id: string) {
    return this.recurring.get(id);
  }
  @Post() @RequirePermissions("retainers:create") create(@Body() input: CreateRecurringInvoiceDto) {
    return this.recurring.create(input);
  }
  @Patch(":id") @RequirePermissions("retainers:update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateRecurringInvoiceDto,
  ) {
    return this.recurring.update(id, input);
  }
  @Post(":id/pause") @HttpCode(200) @RequirePermissions("retainers:update") pause(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RecurringTransitionDto,
  ) {
    return this.recurring.transition(id, input.expectedVersion, "PAUSED");
  }
  @Post(":id/resume") @HttpCode(200) @RequirePermissions("retainers:update") resume(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RecurringTransitionDto,
  ) {
    return this.recurring.transition(id, input.expectedVersion, "ACTIVE");
  }
  @Post(":id/cancel") @HttpCode(200) @RequirePermissions("retainers:delete") cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RecurringTransitionDto,
  ) {
    return this.recurring.transition(id, input.expectedVersion, "CANCELLED");
  }
  @Get(":id/occurrences") @RequirePermissions("retainers:read") occurrences(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.recurring.occurrences(id);
  }
  @Post(":id/occurrences/:occurrenceId/retry")
  @HttpCode(202)
  @RequirePermissions("retainers:update")
  retry(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("occurrenceId", ParseUUIDPipe) occurrenceId: string,
  ) {
    return this.recurring.retry(id, occurrenceId);
  }
}
