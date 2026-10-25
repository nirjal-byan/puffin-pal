import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import { FinancialSummaryQueryDto } from "./financial-summary.dto.js";
import { FinancialSummaryService } from "./financial-summary.service.js";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class FinancialSummaryController {
  constructor(private readonly summary: FinancialSummaryService) {}

  @Get("financial-summary")
  @RequirePermissions("invoices:read", "expenses:read")
  get(@Query() query: FinancialSummaryQueryDto) {
    return this.summary.get(query);
  }
}
