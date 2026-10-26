import { IsIn, IsOptional, Matches } from "class-validator";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

export class FinancialReportQueryDto {
  @Matches(ISO_DATE, { message: "from must use YYYY-MM-DD" })
  from!: string;

  @Matches(ISO_DATE, { message: "to must use YYYY-MM-DD" })
  to!: string;

  @Matches(CURRENCY, { message: "currency must be a three-letter ISO code" })
  currency!: string;

  @IsOptional()
  @IsIn(["month", "quarter", "year"])
  groupBy: "month" | "quarter" | "year" = "month";
}

export class FinancialReportExportQueryDto extends FinancialReportQueryDto {
  @IsIn(["csv", "pdf"])
  format!: "csv" | "pdf";
}
