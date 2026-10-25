import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import {
  CreateExpenseDto,
  ExpenseQueryDto,
  ExpenseTransitionDto,
  RejectExpenseDto,
  UpdateExpenseDto,
} from "./expense.dto.js";
import { ExpensesService } from "./expenses.service.js";
import { MAX_RECEIPT_BYTES } from "./receipt-validation.js";
import type { ReceiptFile } from "./receipt-validation.js";

@ApiTags("expenses")
@ApiBearerAuth()
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}
  @Get() @RequirePermissions("expenses:read") list(@Query() query: ExpenseQueryDto) {
    return this.expenses.list(query);
  }
  @Get(":id") @RequirePermissions("expenses:read") get(@Param("id", ParseUUIDPipe) id: string) {
    return this.expenses.get(id);
  }
  @Post() @RequirePermissions("expenses:create") create(@Body() input: CreateExpenseDto) {
    return this.expenses.create(input);
  }
  @Patch(":id") @RequirePermissions("expenses:update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateExpenseDto,
  ) {
    return this.expenses.update(id, input);
  }
  @Delete(":id") @RequirePermissions("expenses:delete") remove(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.expenses.remove(id);
  }
  @Post(":id/submit") @HttpCode(200) @RequirePermissions("expenses:submit") submit(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ExpenseTransitionDto,
  ) {
    return this.expenses.submit(id, input.expectedVersion);
  }
  @Post(":id/approve") @HttpCode(200) @RequirePermissions("expenses:approve") approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ExpenseTransitionDto,
  ) {
    return this.expenses.approve(id, input.expectedVersion);
  }
  @Post(":id/reject") @HttpCode(200) @RequirePermissions("expenses:approve") reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RejectExpenseDto,
  ) {
    return this.expenses.reject(id, input.expectedVersion, input.reason);
  }
  @Post(":id/reopen") @HttpCode(200) @RequirePermissions("expenses:submit") reopen(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ExpenseTransitionDto,
  ) {
    return this.expenses.reopen(id, input.expectedVersion);
  }
  @Put(":id/receipt")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("receipt", { limits: { fileSize: MAX_RECEIPT_BYTES, files: 1 } }),
  )
  @RequirePermissions("expenses:update")
  upload(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: ReceiptFile) {
    return this.expenses.uploadReceipt(id, file);
  }
  @Get(":id/receipt")
  @RequirePermissions("expenses:read")
  @Header("Cache-Control", "private, no-store")
  async receipt(@Param("id", ParseUUIDPipe) id: string) {
    const { expense, buffer } = await this.expenses.receipt(id);
    const filename = (expense.receiptName ?? "receipt").replace(/[^a-zA-Z0-9._-]/g, "_");
    return new StreamableFile(buffer, {
      type: expense.receiptMime ?? "application/octet-stream",
      disposition: `inline; filename="${filename}"`,
      length: buffer.length,
    });
  }
  @Delete(":id/receipt") @RequirePermissions("expenses:update") removeReceipt(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.expenses.removeReceipt(id);
  }
}
