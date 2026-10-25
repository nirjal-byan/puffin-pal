import { Type } from "class-transformer";
import {
  IsArray,
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
  ValidateNested,
} from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const RATE = /^(?:0|1)(?:\.\d{1,6})?$/;

export class JurisdictionDto {
  @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @IsOptional() @Matches(/^[A-Z0-9-]{1,12}$/) subdivisionCode?: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsInt() @Min(1) @Max(12) taxYearStartMonth = 1;
  @IsInt() @Min(1) @Max(31) taxYearStartDay = 1;
  @IsBoolean() mandatoryCalculation = false;
}

export class TaxBracketDto {
  @Matches(MONEY) lowerBound!: string;
  @IsOptional() @Matches(MONEY) upperBound?: string;
  @Matches(RATE) rate!: string;
}

export class StatutoryItemDto {
  @IsString() @MaxLength(100) name!: string;
  @IsIn(["FLAT_WITHHOLDING", "EMPLOYEE_CONTRIBUTION", "EMPLOYER_CONTRIBUTION"])
  kind!: "FLAT_WITHHOLDING" | "EMPLOYEE_CONTRIBUTION" | "EMPLOYER_CONTRIBUTION";
  @IsIn(["RATE", "FIXED_AMOUNT"]) calculationType!: "RATE" | "FIXED_AMOUNT";
  @IsIn(["TAXABLE_EARNINGS", "GROSS_EARNINGS"]) calculationBase!:
    "TAXABLE_EARNINGS" | "GROSS_EARNINGS";
  @IsOptional() @Matches(RATE) rate?: string;
  @IsOptional() @Matches(MONEY) fixedAmount?: string;
  @IsOptional() @Matches(MONEY) minimumBase?: string;
  @IsOptional() @Matches(MONEY) maximumBase?: string;
  @IsOptional() @Matches(MONEY) contributionCap?: string;
}

export class CreateStatutoryRuleSetDto {
  @IsUUID() jurisdictionId!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsInt() @Min(1) version!: number;
  @Matches(DATE) effectiveFrom!: string;
  @IsOptional() @Matches(DATE) effectiveTo?: string;
  @IsOptional() @IsInt() @Min(1) @Max(366) periodsPerYear?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TaxBracketDto) brackets!: TaxBracketDto[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatutoryItemDto)
  rules!: StatutoryItemDto[];
}

export class ActivateStatutoryRuleDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
export class StatutoryPreviewDto {
  @IsUUID() ruleSetId!: string;
}
export class ApplyStatutoryDto extends StatutoryPreviewDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(128) previewHash!: string;
}

export class ComponentClassificationDto {
  @IsIn(["TAXABLE_EARNING", "NON_TAXABLE_EARNING", "PRE_TAX_DEDUCTION", "POST_TAX_DEDUCTION"])
  statutoryClass!:
    "TAXABLE_EARNING" | "NON_TAXABLE_EARNING" | "PRE_TAX_DEDUCTION" | "POST_TAX_DEDUCTION";
}
