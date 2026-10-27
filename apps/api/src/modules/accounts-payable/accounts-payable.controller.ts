import {
  Body,
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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import { AccountsPayableService } from "./accounts-payable.service.js";
import {
  CreateVendorBillDto,
  PayablesQueryDto,
  PayablePaymentInputDto,
  PayableTargetDto,
  RecordPayablePaymentDto,
  RejectBillDto,
  ReversePayablePaymentDto,
  VendorDto,
  UpdateVendorDto,
  UpdateVendorBillDto,
  VersionDto,
} from "./accounts-payable.dto.js";

@ApiTags("accounts-payable")
@ApiBearerAuth()
@Controller()
export class AccountsPayableController {
  constructor(private readonly service: AccountsPayableService) {}
  @Get("vendors") @RequirePermissions("vendors:read") vendors(@Query() query: PayablesQueryDto) {
    return this.service.listVendors(query);
  }
  @Get("vendors/:id") @RequirePermissions("vendors:read") vendor(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.getVendor(id);
  }
  @Post("vendors") @RequirePermissions("vendors:manage") createVendor(@Body() input: VendorDto) {
    return this.service.createVendor(input);
  }
  @Patch("vendors/:id") @RequirePermissions("vendors:manage") updateVendor(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateVendorDto,
  ) {
    return this.service.updateVendor(id, input);
  }
  @Delete("vendors/:id") @RequirePermissions("vendors:manage") archiveVendor(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.archiveVendor(id);
  }
  @Post("vendors/:id/archive")
  @HttpCode(200)
  @RequirePermissions("vendors:manage")
  archiveVendorAction(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.archiveVendor(id);
  }

  @Get("accounts-payable/summary") @RequirePermissions("accounts-payable:read") summary() {
    return this.service.summary();
  }
  @Get("accounts-payable/aging") @RequirePermissions("accounts-payable:read") async aging() {
    const summary = await this.service.summary();
    return {
      outstanding: summary.outstanding,
      overdue: summary.overdue,
      dueWithin7Days: summary.dueWithin7Days,
      dueWithin30Days: summary.dueWithin30Days,
      aging: summary.aging,
      vendorBalances: summary.vendorBalances,
    };
  }
  @Get("accounts-payable/bills") @RequirePermissions("accounts-payable:read") bills(
    @Query() query: PayablesQueryDto,
  ) {
    return this.service.listBills(query);
  }
  @Get("accounts-payable/bills/:id") @RequirePermissions("accounts-payable:read") bill(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.getBill(id);
  }
  @Put("accounts-payable/bills/:id/attachment")
  @UseInterceptors(
    FileInterceptor("attachment", { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }),
  )
  @RequirePermissions("accounts-payable:manage")
  uploadAttachment(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.service.uploadAttachment(id, file);
  }
  @Get("accounts-payable/bills/:id/attachment")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions("accounts-payable:read")
  async attachment(@Param("id", ParseUUIDPipe) id: string) {
    const { bill, object } = await this.service.attachment(id);
    const filename = (bill.attachmentName ?? "bill-attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
    return new StreamableFile(object.buffer, {
      type: bill.attachmentMime ?? object.contentType ?? "application/octet-stream",
      disposition: `inline; filename="${filename}"`,
      length: object.buffer.length,
    });
  }
  @Delete("accounts-payable/bills/:id/attachment")
  @RequirePermissions("accounts-payable:manage")
  removeAttachment(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.removeAttachment(id);
  }
  @Post("accounts-payable/bills") @RequirePermissions("accounts-payable:manage") createBill(
    @Body() input: CreateVendorBillDto,
  ) {
    return this.service.createBill(input);
  }
  @Patch("accounts-payable/bills/:id")
  @RequirePermissions("accounts-payable:manage")
  updateBill(@Param("id", ParseUUIDPipe) id: string, @Body() input: UpdateVendorBillDto) {
    return this.service.updateBill(id, input);
  }
  @Post("accounts-payable/bills/:id/submit")
  @HttpCode(200)
  @RequirePermissions("accounts-payable:manage")
  submit(@Param("id", ParseUUIDPipe) id: string, @Body() input: VersionDto) {
    return this.service.transitionBill(
      id,
      input.expectedVersion,
      "DRAFT",
      "PENDING_APPROVAL",
      "BILL_SUBMITTED",
    );
  }
  @Post("accounts-payable/bills/:id/approve")
  @HttpCode(200)
  @RequirePermissions("accounts-payable:approve")
  approve(@Param("id", ParseUUIDPipe) id: string, @Body() input: VersionDto) {
    return this.service.transitionBill(
      id,
      input.expectedVersion,
      "PENDING_APPROVAL",
      "APPROVED",
      "BILL_APPROVED",
    );
  }
  @Post("accounts-payable/bills/:id/reject")
  @HttpCode(200)
  @RequirePermissions("accounts-payable:approve")
  reject(@Param("id", ParseUUIDPipe) id: string, @Body() input: RejectBillDto) {
    return this.service.rejectBill(id, input);
  }
  @Post("accounts-payable/bills/:id/resubmit")
  @HttpCode(200)
  @RequirePermissions("accounts-payable:manage")
  resubmit(@Param("id", ParseUUIDPipe) id: string, @Body() input: VersionDto) {
    return this.service.transitionBill(
      id,
      input.expectedVersion,
      "REJECTED",
      "PENDING_APPROVAL",
      "BILL_SUBMITTED",
    );
  }
  @Post("accounts-payable/bills/:id/void")
  @HttpCode(200)
  @RequirePermissions("accounts-payable:approve")
  voidBill(@Param("id", ParseUUIDPipe) id: string, @Body() input: VersionDto) {
    return this.service.transitionBill(
      id,
      input.expectedVersion,
      "APPROVED",
      "VOIDED",
      "BILL_VOIDED",
    );
  }
  @Post("accounts-payable/payments") @RequirePermissions("accounts-payable:pay") payment(
    @Body() input: RecordPayablePaymentDto,
  ) {
    return this.service.recordPayment(input);
  }
  @Get("accounts-payable/bills/:id/payments")
  @RequirePermissions("accounts-payable:read")
  billPayments(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listPayments("VENDOR_BILL", id);
  }
  @Post("accounts-payable/bills/:id/payments")
  @RequirePermissions("accounts-payable:pay")
  payBill(@Param("id", ParseUUIDPipe) id: string, @Body() input: PayablePaymentInputDto) {
    return this.service.recordPayment({
      ...input,
      targetType: PayableTargetDto.VENDOR_BILL,
      targetId: id,
    });
  }
  @Get("expenses/:id/payments")
  @RequirePermissions("expenses:read")
  expensePayments(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listPayments("EXPENSE", id);
  }
  @Post("expenses/:id/payments")
  @RequirePermissions("expenses:pay")
  payExpense(@Param("id", ParseUUIDPipe) id: string, @Body() input: PayablePaymentInputDto) {
    return this.service.recordPayment({
      ...input,
      targetType: PayableTargetDto.EXPENSE,
      targetId: id,
    });
  }
  @Post("expense-payments/:id/reverse")
  @HttpCode(200)
  @RequirePermissions("expenses:pay")
  reverseExpensePayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ReversePayablePaymentDto,
  ) {
    return this.service.reversePayment(id, input);
  }
  @Post("accounts-payable/payments/:id/reverse")
  @HttpCode(200)
  @RequirePermissions("accounts-payable:pay")
  reverse(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReversePayablePaymentDto) {
    return this.service.reversePayment(id, input);
  }
}
