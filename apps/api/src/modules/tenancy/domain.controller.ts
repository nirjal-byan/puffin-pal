import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/auth.decorators.js";
import { PageDto } from "./page.dto.js";
import { TenantDatabaseService } from "./tenant-database.service.js";

@ApiTags("financial records")
@ApiBearerAuth()
@Controller()
export class DomainController {
  constructor(private readonly tenants: TenantDatabaseService) {}
  @Get("retainers")
  @RequirePermissions("retainers:read")
  retainers(@Query() page: PageDto) {
    return this.tenants.listRetainers(page);
  }
}
