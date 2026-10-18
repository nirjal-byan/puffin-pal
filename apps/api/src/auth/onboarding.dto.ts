import { IsIn } from "class-validator";

export const ONBOARDING_STEPS = [
  "welcome",
  "dashboard",
  "clients",
  "invoices",
  "create-invoice",
  "issuance",
  "payment-basics",
  "record-payment",
  "payment-balance",
  "payment-history",
  "payment-status",
  "team",
  "settings",
  "finish",
] as const;

export class UpdateOnboardingDto {
  @IsIn(["IN_PROGRESS", "COMPLETED", "SKIPPED"])
  status!: "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

  @IsIn(ONBOARDING_STEPS)
  step!: (typeof ONBOARDING_STEPS)[number];
}
