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
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import {
  CreatePayrollScheduleDto,
  PayrollHistoryQueryDto,
  PayrollScheduleVersionDto,
  UpdatePayrollScheduleDto,
} from "./payroll-schedule.dto.js";
import { PayrollSchedulesService } from "./payroll-schedules.service.js";

@ApiTags("payroll schedules")
@ApiBearerAuth()
@Controller("payroll/schedules")
export class PayrollSchedulesController {
  constructor(private readonly schedules: PayrollSchedulesService) {}
  @Get() @RequirePermissions("payroll:read") list() {
    return this.schedules.list();
  }
  @Post() @RequirePermissions("payroll:manage") create(@Body() input: CreatePayrollScheduleDto) {
    return this.schedules.create(input);
  }
  @Get(":id") @RequirePermissions("payroll:read") get(@Param("id", ParseUUIDPipe) id: string) {
    return this.schedules.get(id);
  }
  @Patch(":id") @RequirePermissions("payroll:manage") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePayrollScheduleDto,
  ) {
    return this.schedules.update(id, input);
  }
  @Post(":id/pause") @HttpCode(200) @RequirePermissions("payroll:manage") pause(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PayrollScheduleVersionDto,
  ) {
    return this.schedules.transition(id, input.expectedVersion, "PAUSED");
  }
  @Post(":id/resume") @HttpCode(200) @RequirePermissions("payroll:manage") resume(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PayrollScheduleVersionDto,
  ) {
    return this.schedules.transition(id, input.expectedVersion, "ACTIVE");
  }
  @Get(":id/history") @RequirePermissions("payroll:read") history(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: PayrollHistoryQueryDto,
  ) {
    return this.schedules.history(id, query);
  }
  @Post(":id/generate") @HttpCode(202) @RequirePermissions("payroll:manage") generate(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.schedules.generate(id);
  }
}
