import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import {
  CreatePayrollRunDto,
  CalculatePayrollDto,
  PayrollAdjustmentDto,
  PayrollRunQueryDto,
  PayrollVersionDto,
  RecordPayrollPaymentDto,
  RejectPayrollDto,
} from "./payroll.dto.js";
import { PayrollService } from "./payroll.service.js";

@ApiTags("payroll")
@ApiBearerAuth()
@Controller("payroll/runs")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}
  @Get() @RequirePermissions("payroll:read") list(@Query() query: PayrollRunQueryDto) {
    return this.payroll.list(query);
  }
  @Post() @RequirePermissions("payroll:create") create(@Body() input: CreatePayrollRunDto) {
    return this.payroll.create(input);
  }
  @Get(":id") @RequirePermissions("payroll:read") get(@Param("id", ParseUUIDPipe) id: string) {
    return this.payroll.get(id);
  }
  @Post(":id/calculate") @HttpCode(200) @RequirePermissions("payroll:manage") calculate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CalculatePayrollDto,
  ) {
    return this.payroll.calculate(id, input.expectedVersion, input.employeeIds);
  }
  @Post(":id/entries/:entryId/adjustments") @RequirePermissions("payroll:manage") adjust(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("entryId", ParseUUIDPipe) entryId: string,
    @Body() input: PayrollAdjustmentDto,
  ) {
    return this.payroll.adjust(id, entryId, input);
  }
  @Post(":id/submit") @HttpCode(200) @RequirePermissions("payroll:manage") submit(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PayrollVersionDto,
  ) {
    return this.payroll.submit(id, input.expectedVersion);
  }
  @Post(":id/approve") @HttpCode(200) @RequirePermissions("payroll:approve") approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PayrollVersionDto,
  ) {
    return this.payroll.approve(id, input.expectedVersion);
  }
  @Post(":id/reject") @HttpCode(200) @RequirePermissions("payroll:approve") reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RejectPayrollDto,
  ) {
    return this.payroll.reject(id, input.expectedVersion, input.reason);
  }
  @Post(":id/finalize") @HttpCode(200) @RequirePermissions("payroll:finalize") finalize(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PayrollVersionDto,
  ) {
    return this.payroll.finalize(id, input.expectedVersion);
  }
  @Post(":id/entries/:entryId/payments") @RequirePermissions("payroll:payments:record") payment(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("entryId", ParseUUIDPipe) entryId: string,
    @Body() input: RecordPayrollPaymentDto,
  ) {
    return this.payroll.recordPayment(id, entryId, input);
  }
  @Post(":id/entries/:entryId/payslip/retry")
  @HttpCode(200)
  @RequirePermissions("payroll:manage")
  retry(@Param("id", ParseUUIDPipe) id: string, @Param("entryId", ParseUUIDPipe) entryId: string) {
    return this.payroll.retryPayslip(id, entryId);
  }
  @Get(":id/entries/:entryId/payslip")
  @RequirePermissions("payroll:read")
  @Header("Cache-Control", "private, no-store")
  async payslip(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("entryId", ParseUUIDPipe) entryId: string,
  ) {
    const { entry, buffer } = await this.payroll.getPayslip(id, entryId);
    const safe = `${entry.employeeCode}-${entry.employeeName}`
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="payslip-${safe}.pdf"`,
      length: buffer.length,
    });
  }
}
