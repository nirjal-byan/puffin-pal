import { PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export const EXPENSE_CATEGORIES = ["SOFTWARE", "HARDWARE", "TRAVEL", "MARKETING", "OTHER"] as const;
export const EXPENSE_AMOUNT_PATTERN = /^(?:0*[0-9]{1,10})(?:\.[0-9]{1,2})?$/;

export class CreateExpenseDto {
  @IsString() @Matches(/\S/) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsString() @Matches(EXPENSE_AMOUNT_PATTERN) amount!: string;
  @IsIn(EXPENSE_CATEGORIES) category!: (typeof EXPENSE_CATEGORIES)[number];
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsOptional() @IsString() @MaxLength(160) vendor?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto, { skipNullProperties: false }) {}

export class ExpenseQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(EXPENSE_CATEGORIES) category?: (typeof EXPENSE_CATEGORIES)[number];
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(["date", "title", "amount", "createdAt"]) sort: "date" | "title" | "amount" | "createdAt" = "date";
  @IsOptional() @Transform(({ value }) => String(value).toLowerCase()) @IsIn(["asc", "desc"]) order: "asc" | "desc" = "desc";
}
