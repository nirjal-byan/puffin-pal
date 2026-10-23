import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import {
  ActivateStatutoryRuleDto,
  ApplyStatutoryDto,
  ComponentClassificationDto,
  CreateStatutoryRuleSetDto,
  JurisdictionDto,
  StatutoryPreviewDto,
} from "./payroll-statutory.dto.js";
import { PayrollStatutoryService } from "./payroll-statutory.service.js";

@ApiTags("payroll-statutory")
@ApiBearerAuth()
@Controller("payroll")
export class PayrollStatutoryController {
  constructor(private readonly statutory: PayrollStatutoryService) {}
  @Get("statutory/jurisdictions") @RequirePermissions("payroll:read") jurisdictions() {
    return this.statutory.jurisdictions();
  }
  @Post("statutory/jurisdictions") @RequirePermissions("payroll:manage") saveJurisdiction(
    @Body() input: JurisdictionDto,
  ) {
    return this.statutory.saveJurisdiction(input);
  }
  @Get("statutory/rules") @RequirePermissions("payroll:read") rules() {
    return this.statutory.rules();
  }
  @Get("statutory/reports") @RequirePermissions("payroll:read") reports() {
    return this.statutory.report();
  }
  @Post("statutory/rules") @RequirePermissions("payroll:manage") createRule(
    @Body() input: CreateStatutoryRuleSetDto,
  ) {
    return this.statutory.createRuleSet(input);
  }
  @Post("statutory/rules/:id/activate") @RequirePermissions("payroll:manage") activate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ActivateStatutoryRuleDto,
  ) {
    return this.statutory.activate(id, input.expectedVersion);
  }
  @Patch("statutory/components/:id") @RequirePermissions("payroll:manage") classify(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ComponentClassificationDto,
  ) {
    return this.statutory.classify(id, input);
  }
  @Post("runs/:id/statutory/preview") @RequirePermissions("payroll:manage") preview(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: StatutoryPreviewDto,
  ) {
    return this.statutory.preview(id, input.ruleSetId);
  }
  @Post("runs/:id/statutory/apply") @RequirePermissions("payroll:manage") apply(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ApplyStatutoryDto,
  ) {
    return this.statutory.apply(id, input);
  }
}
