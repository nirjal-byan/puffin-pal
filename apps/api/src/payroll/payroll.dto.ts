import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class PayrollRunQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @Type(() => Number) @IsInt() @Min(0) offset = 0;
  @IsOptional()
  @IsIn(["DRAFT", "PENDING_APPROVAL", "APPROVED", "FINALIZED"])
  status?: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "FINALIZED";
}

export class CreatePayrollRunDto {
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
  @Matches(DATE) periodStart!: string;
  @Matches(DATE) periodEnd!: string;
  @Matches(DATE) paymentDate!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  employeeIds?: string[];
}

export class PayrollVersionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CalculatePayrollDto extends PayrollVersionDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  employeeIds?: string[];
}

export class RejectPayrollDto extends PayrollVersionDto {
  @IsString() @Matches(/\S/) @MaxLength(1000) reason!: string;
}

export class PayrollAdjustmentDto extends PayrollVersionDto {
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
  @IsIn(["EARNING", "DEDUCTION"]) type!: "EARNING" | "DEDUCTION";
  @Matches(MONEY) amount!: string;
}

export class ImportOvertimeDto extends PayrollVersionDto {
  @IsUUID() overtimeRequestId!: string;
}

export class RecordPayrollPaymentDto {
  @Matches(MONEY) amount!: string;
  @Matches(DATE) paymentDate!: string;
  @IsString() @Matches(/\S/) @MaxLength(160) reference!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsString() @Matches(/\S/) @MaxLength(160) idempotencyKey!: string;
}
