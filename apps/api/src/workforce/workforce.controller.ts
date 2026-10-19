import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import {
  AttendanceDto,
  HolidayDto,
  LeaveRequestDto,
  LeaveTypeDto,
  OvertimeRequestDto,
  ReviewLeaveDto,
  ReviewOvertimeDto,
  WorkforceQueryDto,
  WorkScheduleDto,
} from "./workforce.dto.js";
import { WorkforceService } from "./workforce.service.js";

@ApiTags("workforce")
@ApiBearerAuth()
@Controller()
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService) {}

  @Get("attendance") @RequirePermissions("attendance:read") attendance(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.attendance(query);
  }
  @Get("attendance/mine") @RequirePermissions("attendance:self") myAttendance(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.attendance(query, true);
  }
  @Get("attendance/summary") @RequirePermissions("attendance:read") summary(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.attendanceSummary(query);
  }
  @Post("attendance") @RequirePermissions("attendance:manage") record(
    @Body() input: AttendanceDto,
  ) {
    return this.workforce.recordAttendance(input);
  }
  @Post("attendance/check-in") @HttpCode(200) @RequirePermissions("attendance:self") checkIn() {
    return this.workforce.checkIn();
  }
  @Post("attendance/check-out") @HttpCode(200) @RequirePermissions("attendance:self") checkOut() {
    return this.workforce.checkOut();
  }

  @Get("attendance/schedules") @RequirePermissions("attendance:read") schedules(
    @Query("employeeId") employeeId?: string,
  ) {
    return this.workforce.schedules(employeeId);
  }
  @Post("attendance/schedules") @RequirePermissions("attendance:manage") createSchedule(
    @Body() input: WorkScheduleDto,
  ) {
    return this.workforce.createSchedule(input);
  }
  @Get("attendance/holidays") @RequirePermissions("attendance:read") holidays(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.holidays(query);
  }
  @Post("attendance/holidays") @RequirePermissions("attendance:manage") createHoliday(
    @Body() input: HolidayDto,
  ) {
    return this.workforce.createHoliday(input);
  }
  @Delete("attendance/holidays/:id") @RequirePermissions("attendance:manage") deleteHoliday(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.workforce.deleteHoliday(id);
  }

  @Get("leave/types") @RequirePermissions("leave:read") leaveTypes() {
    return this.workforce.leaveTypes();
  }
  @Post("leave/types") @RequirePermissions("leave:manage") createLeaveType(
    @Body() input: LeaveTypeDto,
  ) {
    return this.workforce.createLeaveType(input);
  }
  @Get("leave/requests") @RequirePermissions("leave:read") leaveRequests(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.leaveRequests(query);
  }
  @Get("leave/requests/mine") @RequirePermissions("leave:request") myLeaveRequests(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.leaveRequests(query, true);
  }
  @Post("leave/requests") @RequirePermissions("leave:request") createLeave(
    @Body() input: LeaveRequestDto,
  ) {
    return this.workforce.createLeave(input, true);
  }
  @Post("leave/requests/manage") @RequirePermissions("leave:manage") createLeaveForEmployee(
    @Body() input: LeaveRequestDto,
  ) {
    return this.workforce.createLeave(input);
  }
  @Get("leave/balances") @RequirePermissions("leave:read") balances(
    @Query("employeeId") employeeId?: string,
  ) {
    return this.workforce.leaveBalances(employeeId);
  }
  @Post("leave/requests/:id/submit")
  @HttpCode(200)
  @RequirePermissions("leave:request")
  submitLeave(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewLeaveDto) {
    return this.workforce.transitionLeave(id, "submit", input, true);
  }
  @Post("leave/requests/:id/approve")
  @HttpCode(200)
  @RequirePermissions("leave:approve")
  approveLeave(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewLeaveDto) {
    return this.workforce.transitionLeave(id, "approve", input);
  }
  @Post("leave/requests/:id/reject")
  @HttpCode(200)
  @RequirePermissions("leave:approve")
  rejectLeave(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewLeaveDto) {
    return this.workforce.transitionLeave(id, "reject", input);
  }
  @Post("leave/requests/:id/cancel")
  @HttpCode(200)
  @RequirePermissions("leave:request")
  cancelLeave(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewLeaveDto) {
    return this.workforce.transitionLeave(id, "cancel", input, true);
  }

  @Get("overtime") @RequirePermissions("overtime:read") overtime(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.overtime(query);
  }
  @Get("overtime/mine") @RequirePermissions("overtime:request") myOvertime(
    @Query() query: WorkforceQueryDto,
  ) {
    return this.workforce.overtime(query, true);
  }
  @Post("overtime") @RequirePermissions("overtime:request") createOvertime(
    @Body() input: OvertimeRequestDto,
  ) {
    return this.workforce.createOvertime(input, true);
  }
  @Post("overtime/manage") @RequirePermissions("overtime:manage") createOvertimeForEmployee(
    @Body() input: OvertimeRequestDto,
  ) {
    return this.workforce.createOvertime(input);
  }
  @Post("overtime/:id/submit")
  @HttpCode(200)
  @RequirePermissions("overtime:request")
  submitOvertime(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewOvertimeDto) {
    return this.workforce.transitionOvertime(id, "submit", input, true);
  }
  @Post("overtime/:id/approve")
  @HttpCode(200)
  @RequirePermissions("overtime:approve")
  approveOvertime(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewOvertimeDto) {
    return this.workforce.transitionOvertime(id, "approve", input);
  }
  @Post("overtime/:id/reject")
  @HttpCode(200)
  @RequirePermissions("overtime:approve")
  rejectOvertime(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewOvertimeDto) {
    return this.workforce.transitionOvertime(id, "reject", input);
  }
  @Post("overtime/:id/cancel")
  @HttpCode(200)
  @RequirePermissions("overtime:request")
  cancelOvertime(@Param("id", ParseUUIDPipe) id: string, @Body() input: ReviewOvertimeDto) {
    return this.workforce.transitionOvertime(id, "cancel", input, true);
  }
}
