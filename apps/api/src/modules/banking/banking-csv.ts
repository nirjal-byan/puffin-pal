import { createHash } from "node:crypto";

export type ImportMapping = {
  date: string;
  amount: string;
  description: string;
  reference?: string;
  currency?: string;
  direction?: string;
};

export type ParsedBankRow = {
  row: number;
  date: string;
  amount: string;
  direction: "CREDIT" | "DEBIT";
  currency: string;
  description: string;
  reference: string | null;
  fingerprint: string;
};

function csvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const character = input[index]!;
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function amount(value: string) {
  const normalized = value.trim().replaceAll(",", "");
  if (!/^-?(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(normalized))
    throw new Error(`Invalid amount: ${value}`);
  const negative = normalized.startsWith("-");
  return { value: (negative ? normalized.slice(1) : normalized).replace(/^$/, "0"), negative };
}

export function parseBankCsv(
  csv: string,
  mapping: ImportMapping,
  accountCurrency: string,
): ParsedBankRow[] {
  const rows = csvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one transaction");
  if (rows.length > 5001) throw new Error("CSV imports are limited to 5,000 transactions");
  const headers = rows[0]!.map((header) => header.trim().toLowerCase());
  const column = (name: string | undefined, required = false) => {
    if (!name) return -1;
    const index = headers.indexOf(name.trim().toLowerCase());
    if (required && index < 0) throw new Error(`CSV column not found: ${name}`);
    return index;
  };
  const columns = {
    date: column(mapping.date, true),
    amount: column(mapping.amount, true),
    description: column(mapping.description, true),
    reference: column(mapping.reference),
    currency: column(mapping.currency),
    direction: column(mapping.direction),
  };
  return rows.slice(1).map((values, index) => {
    const transactionDate = values[columns.date]?.trim() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate))
      throw new Error(`Row ${index + 2}: date must use YYYY-MM-DD`);
    const parsedAmount = amount(values[columns.amount] ?? "");
    const directionValue =
      columns.direction >= 0 ? values[columns.direction]?.trim().toUpperCase() : "";
    const direction = directionValue
      ? directionValue === "CREDIT" || directionValue === "DEBIT"
        ? directionValue
        : (() => {
            throw new Error(`Row ${index + 2}: direction must be CREDIT or DEBIT`);
          })()
      : parsedAmount.negative
        ? "DEBIT"
        : "CREDIT";
    const currency = (columns.currency >= 0 ? values[columns.currency] : accountCurrency)
      ?.trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency ?? "")) throw new Error(`Row ${index + 2}: invalid currency`);
    const description = (values[columns.description] ?? "").trim().slice(0, 500);
    if (!description) throw new Error(`Row ${index + 2}: description is required`);
    const reference =
      columns.reference >= 0 ? values[columns.reference]?.trim().slice(0, 160) || null : null;
    const fingerprint = createHash("sha256")
      .update(
        [
          transactionDate,
          parsedAmount.value,
          direction,
          currency,
          description,
          reference ?? "",
        ].join("\u001f"),
      )
      .digest("hex");
    return {
      row: index + 2,
      date: transactionDate,
      amount: parsedAmount.value,
      direction,
      currency: currency!,
      description,
      reference,
      fingerprint,
    };
  });
}

export function csvSourceHash(csv: string) {
  return createHash("sha256").update(csv).digest("hex");
}
