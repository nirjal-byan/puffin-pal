import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class IssueInvoiceDto {
  @ApiProperty({ minimum: 1, description: "Version returned by the last read" })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  expectedVersion!: number;
}
