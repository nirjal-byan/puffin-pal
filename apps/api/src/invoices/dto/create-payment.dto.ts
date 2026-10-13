import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { IssueInvoiceDto } from "./issue-invoice.dto.js";

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "OTHER"] as const;
export class CreatePaymentDto extends IssueInvoiceDto {
  @ApiProperty({ example: "125.50" })
  @IsString()
  @Matches(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({ example: "2026-10-13" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paymentDate!: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
