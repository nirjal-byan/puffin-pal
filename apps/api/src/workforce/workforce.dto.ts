import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MONEY = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/;

export class WorkforceQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @IsString() @MaxLength(40) status?: string;
}

export class AttendanceDto {
  @IsUUID() employeeId!: string;
  @Matches(DATE) workDate!: string;
  @IsIn(["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"]) status!:
    "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY";
  @IsOptional() @IsBoolean() isLate?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1440) workedMinutes?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class WorkScheduleDto {
  @IsUUID() employeeId!: string;
  @IsString() @MaxLength(100) name = "Standard schedule";
  @IsString() @MaxLength(80) timezone!: string;
  @IsString() @Matches(/^\[(?:[1-7](?:,[1-7])*)?\]$/) workdays = "[1,2,3,4,5]";
  @Matches(TIME) scheduledStartTime!: string;
  @Matches(TIME) scheduledEndTime!: string;
  @IsInt() @Min(1) @Max(1440) expectedDailyMinutes!: number;
  @IsOptional() @IsInt() @Min(0) @Max(1440) breakMinutes = 0;
  @IsOptional() @IsBoolean() isActive = true;
  @Matches(DATE) effectiveFrom!: string;
  @IsOptional() @Matches(DATE) effectiveTo?: string;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class LeaveTypeDto {
  @IsString() @MaxLength(100) name!: string;
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,19}$/) code!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsBoolean() isPaid!: boolean;
  @IsOptional() @IsBoolean() requiresApproval = true;
  @IsInt() @Min(0) @Max(730) annualAllowanceUnits!: number;
}

export class LeaveRequestDto {
  @IsUUID() employeeId!: string;
  @IsUUID() leaveTypeId!: string;
  @Matches(DATE) startDate!: string;
  @Matches(DATE) endDate!: string;
  @IsIn(["FULL_DAY", "HALF_DAY"]) dayPortion!: "FULL_DAY" | "HALF_DAY";
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class OvertimeRequestDto {
  @IsUUID() employeeId!: string;
  @Matches(DATE) workDate!: string;
  @IsInt() @Min(1) @Max(1440) requestedMinutes!: number;
  @IsString() @MaxLength(1000) reason!: string;
  @IsOptional() @Matches(MONEY) hourlyRate?: string;
  @IsOptional() @Matches(MONEY) multiplier?: string;
}

export class VersionDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

export class ReviewLeaveDto extends VersionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReviewOvertimeDto extends VersionDto {
  @IsOptional() @IsInt() @Min(1) @Max(1440) approvedMinutes?: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class HolidayDto {
  @IsString() @MaxLength(100) name!: string;
  @Matches(DATE) date!: string;
  @IsOptional() @IsBoolean() isRecurring = false;
  @IsOptional() @IsInt() @Min(1) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class ImportOvertimeDto extends VersionDto {
  @IsUUID() overtimeRequestId!: string;
}

export class WorkforceSettingsDto {
  @IsString() @MaxLength(100) timezone!: string;
  @IsBoolean() unpaidLeaveDeductionsEnabled!: boolean;
}

export class LeaveAccrualPolicyDto {
  @IsUUID() leaveTypeId!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsIn(["ANNUAL", "MONTHLY", "SERVICE_MONTHLY"]) frequency!:
    "ANNUAL" | "MONTHLY" | "SERVICE_MONTHLY";
  @IsInt() @Min(1) @Max(525600) entitlementMinutes!: number;
  @Matches(DATE) effectiveFrom!: string;
  @IsOptional() @Matches(DATE) effectiveTo?: string;
  @IsOptional() @IsBoolean() prorateNewJoiners = false;
  @IsOptional() @IsInt() @Min(1) @Max(1051200) maximumBalanceMinutes?: number;
  @IsIn(["NONE", "FULL", "CAPPED"]) carryForwardMode!: "NONE" | "FULL" | "CAPPED";
  @ValidateIf((value: LeaveAccrualPolicyDto) => value.carryForwardMode === "CAPPED")
  @IsInt()
  @Min(0)
  @Max(525600)
  carryForwardCapMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(120) expiresAfterMonths?: number;
  @IsOptional() @IsBoolean() isActive = true;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class LeaveAccrualRunDto {
  @Matches(DATE) asOfDate!: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() policyId?: string;
  @IsOptional() @IsBoolean() preview = true;
}

export class LeaveBalanceAdjustmentDto {
  @IsUUID() employeeId!: string;
  @IsUUID() leaveTypeId!: string;
  @IsInt() @Min(-525600) @Max(525600) minutes!: number;
  @Matches(DATE) effectiveDate!: string;
  @IsString() @MaxLength(500) reason!: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class AttendanceCorrectionDto {
  @IsUUID() attendanceRecordId!: string;
  @IsIn(["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"]) proposedStatus!:
    "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY";
  @IsOptional() @IsString() @MaxLength(50) proposedCheckInAt?: string;
  @IsOptional() @IsString() @MaxLength(50) proposedCheckOutAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1440) proposedWorkedMinutes?: number;
  @IsString() @MaxLength(1000) reason!: string;
}

export class ReviewAttendanceCorrectionDto extends VersionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class WorkforceCalendarQueryDto {
  @Matches(DATE) from!: string;
  @Matches(DATE) to!: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
