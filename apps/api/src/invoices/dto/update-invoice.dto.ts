import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";
import { CreateInvoiceDto } from "./create-invoice.dto.js";

// PATCH replaces the editable draft fields; omitted notes preserve their value.
// An empty notes string explicitly clears them.
export class UpdateInvoiceDto extends CreateInvoiceDto {
  @ApiProperty({ minimum: 1, description: "Version returned by the last read" })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  expectedVersion!: number;
}

export class DeleteInvoiceDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  expectedVersion!: number;
}
