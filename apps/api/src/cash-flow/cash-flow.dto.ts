import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, Matches, Max, Min, ValidateIf } from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class CashFlowForecastQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) horizonDays?: number;
  @IsOptional()
  @IsIn(["CONSERVATIVE", "EXPECTED", "OPTIMISTIC"])
  scenario: "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC" = "EXPECTED";
}

export class UpdateCashFlowConfigurationDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsOptional() @ValidateIf((_, value) => value !== null) @Matches(MONEY) openingBalance?:
    string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @Matches(DATE) openingBalanceDate?:
    string | null;
  @IsOptional() @IsInt() @Min(1) @Max(365) defaultHorizonDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) expectedInvoiceCollectionDelay?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) conservativeDelayAdjustmentDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) optimisticDelayAdjustmentDays?: number;
  @IsOptional() @IsBoolean() includeRecurringInvoices?: boolean;
  @IsOptional() @IsBoolean() includeApprovedPayroll?: boolean;
  @IsOptional() @IsBoolean() includeSalaryEstimates?: boolean;
  @IsOptional() @IsBoolean() includeApprovedExpenses?: boolean;
}
