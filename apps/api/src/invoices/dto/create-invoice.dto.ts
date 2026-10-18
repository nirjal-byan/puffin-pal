import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// Numeric(12,2): ten integer digits and at most two fractional digits.
export const UNIT_PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/;
export class CreateInvoiceItemDto {
  @ApiProperty({ example: "Design services" })
  @IsString()
  @MaxLength(1000)
  @Matches(/\S/)
  description!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;

  @ApiProperty({
    type: String,
    example: "125.50",
    description: "Nonnegative decimal string with at most 10 integer digits and 2 decimal places.",
  })
  @IsString()
  @Matches(UNIT_PRICE_PATTERN)
  unitPrice!: string;
}
export class CreateInvoiceDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  clientId!: string;
  @ApiProperty({
    example: "2026-10-10",
    description: "ISO calendar date (UTC midnight) or ISO timestamp with an explicit timezone.",
  })
  @IsDateString({ strict: true })
  @Matches(DATE_PATTERN)
  issueDate!: string;
  @ApiProperty({ example: "2026-11-10" })
  @IsDateString({ strict: true })
  @Matches(DATE_PATTERN)
  dueDate!: string;
  @ApiPropertyOptional({ maxLength: 5000 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  notes?: string;
  @ApiProperty({ type: [CreateInvoiceItemDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}
