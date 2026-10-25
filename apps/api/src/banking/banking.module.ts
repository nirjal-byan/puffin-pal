import { Module } from "@nestjs/common";
import { BankingController } from "./banking.controller.js";
import { BankingService } from "./banking.service.js";

@Module({ controllers: [BankingController], providers: [BankingService] })
export class BankingModule {}
