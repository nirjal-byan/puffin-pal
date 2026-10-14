import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { TenantDatabaseService } from "../tenancy/tenant-database.service.js";
import { PageDto } from "../tenancy/page.dto.js";
import { CreateClientDto, UpdateClientDto } from "./client.dto.js";

@ApiTags("clients")
@ApiBearerAuth()
@Controller("clients")
export class ClientsController {
  constructor(private readonly tenants: TenantDatabaseService) {}
  @Get()
  @RequirePermissions("clients:read")
  list(@Query() page: PageDto) {
    return this.tenants.listClients(page);
  }
  @Get(":id")
  @RequirePermissions("clients:read")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.tenants.getClient(id);
  }
  @Post()
  @RequirePermissions("clients:create")
  create(@Body() input: CreateClientDto) {
    return this.tenants.createClient(input);
  }
  @Patch(":id")
  @RequirePermissions("clients:update")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateClientDto,
  ) {
    return this.tenants.updateClient(id, input);
  }
  @Delete(":id")
  @RequirePermissions("clients:delete")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.tenants.deleteClient(id);
  }
}
