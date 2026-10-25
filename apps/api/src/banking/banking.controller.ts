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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import {
  BankAccountDto,
  BankImportDto,
  BankingPageDto,
  CreatePaymentBatchDto,
  PaymentBatchItemDto,
  ReconcileDto,
  ReverseReconciliationDto,
} from "./banking.dto.js";
import { BankingService } from "./banking.service.js";

@ApiTags("banking")
@ApiBearerAuth()
@Controller("banking")
export class BankingController {
  constructor(private readonly banking: BankingService) {}

  @Get("accounts") @RequirePermissions("banking:read") accounts() {
    return this.banking.listAccounts();
  }
  @Post("accounts") @RequirePermissions("banking:manage") createAccount(
    @Body() input: BankAccountDto,
  ) {
    return this.banking.createAccount(input);
  }
  @Patch("accounts/:id") @RequirePermissions("banking:manage") updateAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: BankAccountDto,
  ) {
    return this.banking.updateAccount(id, input);
  }

  @Post("imports/preview") @HttpCode(200) @RequirePermissions("banking:manage") preview(
    @Body() input: BankImportDto,
  ) {
    return this.banking.previewImport(input);
  }
  @Post("imports") @RequirePermissions("banking:manage") import(@Body() input: BankImportDto) {
    return this.banking.confirmImport(input);
  }
  @Get("imports") @RequirePermissions("banking:read") imports(@Query() query: BankingPageDto) {
    return this.banking.listImports(query);
  }
  @Get("transactions") @RequirePermissions("banking:read") transactions(
    @Query() query: BankingPageDto,
  ) {
    return this.banking.listTransactions(query);
  }
  @Get("transactions/:id/suggestions") @RequirePermissions("banking:reconcile") suggestions(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.banking.suggestions(id);
  }
  @Post("transactions/:id/reconcile") @RequirePermissions("banking:reconcile") reconcile(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ReconcileDto,
  ) {
    return this.banking.reconcile(id, input);
  }
  @Post("reconciliations/:id/reverse")
  @HttpCode(200)
  @RequirePermissions("banking:reconcile")
  reverse(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReverseReconciliationDto) {
    return this.banking.reverseReconciliation(id, input);
  }

  @Get("payment-batches") @RequirePermissions("banking:read") batches() {
    return this.banking.listPaymentBatches();
  }
  @Get("payment-obligations") @RequirePermissions("banking:manage") obligations() {
    return this.banking.listPaymentObligations();
  }
  @Post("payment-batches") @RequirePermissions("banking:manage") createBatch(
    @Body() input: CreatePaymentBatchDto,
  ) {
    return this.banking.createPaymentBatch(input);
  }
  @Patch("payment-batches/:batchId/items/:itemId")
  @RequirePermissions("banking:manage")
  updateBatchItem(
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() input: PaymentBatchItemDto,
  ) {
    return this.banking.updatePaymentBatchItem(batchId, itemId, input);
  }
  @Get("audit") @RequirePermissions("banking:read") audit(@Query() query: BankingPageDto) {
    return this.banking.listAudit(query);
  }
}
