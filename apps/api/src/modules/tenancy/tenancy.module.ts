import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ClientsController } from "../clients/clients.controller.js";
import { TenantDatabaseService } from "./tenant-database.service.js";
import { DomainController } from "./domain.controller.js";
import { MembersController } from "./members.controller.js";
@Module({
  imports: [AuthModule],
  controllers: [ClientsController, DomainController, MembersController],
  providers: [TenantDatabaseService],
})
export class TenancyModule {}
