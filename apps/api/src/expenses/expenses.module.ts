import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ExpensesController } from "./expenses.controller.js";
import { ExpensesService } from "./expenses.service.js";
import { ReceiptStorageService } from "./receipt-storage.service.js";
import { StorageModule } from "../storage/storage.module.js";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ReceiptStorageService],
})
export class ExpensesModule {}
