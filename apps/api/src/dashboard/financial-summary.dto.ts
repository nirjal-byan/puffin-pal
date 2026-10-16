import { Matches } from "class-validator";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class FinancialSummaryQueryDto {
  @Matches(ISO_DATE, { message: "from must use YYYY-MM-DD" })
  from!: string;

  @Matches(ISO_DATE, { message: "to must use YYYY-MM-DD" })
  to!: string;
}
