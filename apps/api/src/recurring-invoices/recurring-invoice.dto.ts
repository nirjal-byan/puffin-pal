import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { CreateInvoiceItemDto } from "../invoices/dto/create-invoice.dto.js";

export class CreateRecurringInvoiceDto {
  @IsUUID() clientId!: string;
  @IsString() @MaxLength(120) @Matches(/\S/) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsIn(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]) frequency!: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  @IsInt() @Min(1) @Max(24) interval!: number;
  @IsDateString({ strict: true }) startDate!: string;
  @IsOptional() @IsDateString({ strict: true }) endDate?: string;
  @IsInt() @Min(0) @Max(365) dueDateOffsetDays!: number;
  @IsBoolean() autoIssue!: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}

export class UpdateRecurringInvoiceDto extends CreateRecurringInvoiceDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class RecurringTransitionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
