import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class CreatePayrollScheduleDto {
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
  @IsIn(["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"])
  frequency!: "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
  @IsString() @MaxLength(100) timezone!: string;
  @Matches(DATE) startDate!: string;
  @Matches(TIME) generationTime!: string;
  @IsOptional() @IsInt() @Min(0) @Max(31) paymentOffsetDays?: number;
}

export class UpdatePayrollScheduleDto extends CreatePayrollScheduleDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class PayrollScheduleVersionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class PayrollHistoryQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @Type(() => Number) @IsInt() @Min(0) offset = 0;
  @IsOptional()
  @IsIn(["PENDING", "PROCESSING", "GENERATED", "FAILED", "CONFLICT", "SKIPPED"])
  status?: "PENDING" | "PROCESSING" | "GENERATED" | "FAILED" | "CONFLICT" | "SKIPPED";
}
