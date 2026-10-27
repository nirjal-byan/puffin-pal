import type { PayablesSummary } from "./types";

export const EMPTY_PAYABLES_SUMMARY: PayablesSummary = {
  outstanding: "0.00",
  overdue: "0.00",
  aging: {
    current: "0.00",
    days1to30: "0.00",
    days31to60: "0.00",
    days61to90: "0.00",
    over90: "0.00",
  },
};

export const PAYABLE_CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "NPR", "INR"].map(
  (value) => ({ value, label: value }),
);

export const PAYABLE_PAGE_SIZE = 10;
