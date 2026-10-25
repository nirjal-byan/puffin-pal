import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const CURRENCY = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;

export class BankAccountDto {
  @IsString() @MaxLength(80) displayName!: string;
  @IsString() @MaxLength(100) bankName!: string;
  @IsString() @MaxLength(120) accountHolder!: string;
  @IsString() @MaxLength(32) maskedIdentifier!: string;
  @Matches(CURRENCY) currency!: string;
  @IsString() @Length(2, 2) countryCode!: string;
  @IsOptional() @IsBoolean() isActive = true;
  @IsOptional() @IsBoolean() isDefault = false;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) expectedVersion?: number;
}

export class BankImportMappingDto {
  @IsString() @MaxLength(80) date = "date";
  @IsString() @MaxLength(80) amount = "amount";
  @IsString() @MaxLength(80) description = "description";
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() @MaxLength(80) currency?: string;
  @IsOptional() @IsString() @MaxLength(80) direction?: string;
}

export class BankImportDto {
  @IsUUID() bankAccountId!: string;
  @IsString() @MaxLength(160) fileName!: string;
  @IsString() @MaxLength(2_000_000) csv!: string;
  @ValidateNested() @Type(() => BankImportMappingDto) mapping!: BankImportMappingDto;
}

export class BankingPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(["ALL", "MATCHED", "UNMATCHED"]) status?: "ALL" | "MATCHED" | "UNMATCHED";
  @IsOptional() @IsUUID() bankAccountId?: string;
}

export class ReconcileDto {
  @IsIn(["INVOICE_PAYMENT", "PAYROLL_PAYMENT"])
  targetType!: "INVOICE_PAYMENT" | "PAYROLL_PAYMENT";
  @IsUUID() targetId!: string;
}

export class ReverseReconciliationDto {
  @IsString() @MaxLength(500) reason!: string;
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

export class CreatePaymentBatchDto {
  @IsUUID() payrollRunId!: string;
  @IsOptional() @IsUUID() bankAccountId?: string;
  @IsString() @MaxLength(100) name!: string;
  @IsArray() @IsUUID("4", { each: true }) entryIds!: string[];
}

export class PaymentBatchItemDto {
  @IsIn(["ATTEMPTED", "PAID", "FAILED"])
  status!: "ATTEMPTED" | "PAID" | "FAILED";
  @IsOptional() @IsString() @MaxLength(120) paymentReference?: string;
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

export class CandidatePaymentDto {
  @Matches(MONEY) amount!: string;
  @Matches(DATE) date!: string;
}
