import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from "class-validator";

export const MAX_EXPORT_INVOICES = 50;

export class CreateInvoiceExportDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  requestId!: string;

  @ApiProperty({ type: [String], maxItems: MAX_EXPORT_INVOICES })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EXPORT_INVOICES)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  invoiceIds!: string[];
}
