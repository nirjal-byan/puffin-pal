import { Module } from "@nestjs/common";
import { WorkforceController } from "./workforce.controller.js";
import { WorkforceService } from "./workforce.service.js";

@Module({
  controllers: [WorkforceController],
  providers: [WorkforceService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
