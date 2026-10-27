export const BILLING_FREQUENCIES = [
  { value: "WEEKLY:1", label: "Every week" },
  { value: "WEEKLY:2", label: "Every 2 weeks" },
  { value: "MONTHLY:1", label: "Every month" },
  { value: "MONTHLY:2", label: "Every 2 months" },
  { value: "QUARTERLY:1", label: "Every quarter" },
  { value: "MONTHLY:6", label: "Every 6 months" },
  { value: "YEARLY:1", label: "Every year" },
  { value: "YEARLY:2", label: "Every 2 years" },
] as const;

export const PAYMENT_TERMS = [
  { value: 0, label: "Due on receipt" },
  { value: 7, label: "Net 7 — due in 7 days" },
  { value: 14, label: "Net 14 — due in 14 days" },
  { value: 30, label: "Net 30 — due in 30 days" },
  { value: 45, label: "Net 45 — due in 45 days" },
  { value: 60, label: "Net 60 — due in 60 days" },
  { value: 90, label: "Net 90 — due in 90 days" },
] as const;
