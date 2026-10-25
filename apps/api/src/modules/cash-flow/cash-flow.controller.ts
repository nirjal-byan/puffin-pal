import { Body, Controller, Get, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import { CashFlowService } from "./cash-flow.service.js";
import { CashFlowForecastQueryDto, UpdateCashFlowConfigurationDto } from "./cash-flow.dto.js";

@ApiTags("cash-flow")
@ApiBearerAuth()
@Controller("cash-flow")
export class CashFlowController {
  constructor(private readonly cashFlow: CashFlowService) {}

  @Get("forecast")
  @RequirePermissions("cash-flow:read")
  forecast(@Query() query: CashFlowForecastQueryDto) {
    return this.cashFlow.forecast(query);
  }

  @Get("summary")
  @RequirePermissions("cash-flow:read")
  async summary(@Query() query: CashFlowForecastQueryDto) {
    const forecast = await this.cashFlow.forecast(query);
    return {
      currency: forecast.currency,
      scenario: forecast.scenario,
      range: forecast.range,
      summary: forecast.summary,
      warnings: forecast.warnings,
    };
  }

  @Get("breakdown")
  @RequirePermissions("cash-flow:read")
  async breakdown(@Query() query: CashFlowForecastQueryDto) {
    const forecast = await this.cashFlow.forecast(query);
    return {
      currency: forecast.currency,
      scenario: forecast.scenario,
      range: forecast.range,
      breakdown: forecast.breakdown,
      events: forecast.events,
    };
  }

  @Get("configuration")
  @RequirePermissions("cash-flow:read")
  configuration() {
    return this.cashFlow.configuration();
  }

  @Patch("configuration")
  @RequirePermissions("cash-flow:manage")
  updateConfiguration(@Body() input: UpdateCashFlowConfigurationDto) {
    return this.cashFlow.updateConfiguration(input);
  }
}
