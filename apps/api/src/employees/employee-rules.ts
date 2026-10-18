export function rangesOverlap(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null) {
  return aStart <= (bEnd ?? "9999-12-31") && bStart <= (aEnd ?? "9999-12-31");
}

export function assertManagerChain(employeeId: string, managerId: string | null, managers: ReadonlyMap<string, string | null>) {
  const visited = new Set<string>([employeeId]);
  let current = managerId;
  while (current) {
    if (visited.has(current)) throw new Error("An employee cannot manage themself, directly or indirectly");
    visited.add(current);
    current = managers.get(current) ?? null;
  }
}
