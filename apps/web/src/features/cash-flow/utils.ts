export function cashFlowSourceLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function cashFlowChartData(
  daily: Array<{
    date: string;
    inflows: string;
    outflows: string;
    closingBalance: string | null;
  }>,
) {
  return daily.map((point) => ({
    ...point,
    inflows: Number(point.inflows),
    outflows: Number(point.outflows),
    closingBalance: point.closingBalance === null ? undefined : Number(point.closingBalance),
  }));
}
