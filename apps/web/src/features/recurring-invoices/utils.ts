export function recurringFrequencyLabel(frequency: string, interval: number) {
  const unit =
    frequency === "WEEKLY"
      ? "week"
      : frequency === "MONTHLY"
        ? "month"
        : frequency === "QUARTERLY"
          ? "quarter"
          : "year";
  return `Every ${interval > 1 ? `${interval} ` : ""}${unit}${interval > 1 ? "s" : ""}`;
}
