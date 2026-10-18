import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { ROLES, type Role } from "@puffinpal/permissions";
import { CurrentTenant, RequirePermissions } from "../auth/auth.decorators.js";
import { CreateMemberDto } from "../auth/auth.dto.js";
import { AuthService } from "../auth/auth.service.js";
import type { TenantContext } from "../auth/auth.types.js";
import { PageDto } from "./page.dto.js";
import { TenantDatabaseService } from "./tenant-database.service.js";

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ROLES.filter((role) => role !== "OWNER") })
  @IsIn(ROLES.filter((role) => role !== "OWNER"))
  role!: Role;
}
@ApiTags("members")
@ApiBearerAuth()
@Controller("members")
export class MembersController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenants: TenantDatabaseService,
  ) {}
  @Get()
  @RequirePermissions("members:read")
  list(@Query() page: PageDto) {
    return this.tenants.listMembers(page);
  }
  @Post()
  @RequirePermissions("members:manage")
  create(@CurrentTenant() tenant: TenantContext, @Body() input: CreateMemberDto) {
    return this.auth.createMember(tenant, input);
  }
  @Patch(":userId/role")
  @RequirePermissions("members:manage")
  updateRole(
    @CurrentTenant() tenant: TenantContext,
    @Param("userId", ParseUUIDPipe) id: string,
    @Body() input: UpdateMemberRoleDto,
  ) {
    return this.auth.updateMemberRole(tenant, id, input.role);
  }
}
