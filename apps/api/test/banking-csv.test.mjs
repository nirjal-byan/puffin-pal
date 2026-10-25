import assert from "node:assert/strict";
import { test } from "node:test";
import { csvSourceHash, parseBankCsv } from "../dist/src/modules/banking/banking-csv.js";

const mapping = {
  date: "date",
  amount: "amount",
  description: "description",
  reference: "reference",
  direction: "direction",
  currency: "currency",
};

test("bank CSV parsing handles quoted fields and normalizes rows deterministically", () => {
  const csv = [
    "date,amount,description,reference,direction,currency",
    '2026-10-25,1250.50,"Invoice, October",INV-42,CREDIT,usd',
    "2026-10-26,-80.00,Bank fee,FEE-1,,USD",
  ].join("\n");
  const rows = parseBankCsv(csv, mapping, "USD");
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map(({ date, amount, direction, currency, description }) => ({
      date,
      amount,
      direction,
      currency,
      description,
    })),
    [
      {
        date: "2026-10-25",
        amount: "1250.50",
        direction: "CREDIT",
        currency: "USD",
        description: "Invoice, October",
      },
      {
        date: "2026-10-26",
        amount: "80.00",
        direction: "DEBIT",
        currency: "USD",
        description: "Bank fee",
      },
    ],
  );
  assert.equal(rows[0].fingerprint, parseBankCsv(csv, mapping, "USD")[0].fingerprint);
  assert.equal(csvSourceHash(csv), csvSourceHash(csv));
});

test("bank CSV parsing rejects unsafe or ambiguous input", () => {
  assert.throws(
    () => parseBankCsv("date,amount,description\n10/25/2026,10,Invalid date", mapping, "USD"),
    /YYYY-MM-DD/,
  );
  assert.throws(
    () =>
      parseBankCsv(
        "date,amount,description,direction\n2026-10-25,10,Payment,SIDEWAYS",
        mapping,
        "USD",
      ),
    /CREDIT or DEBIT/,
  );
  assert.throws(
    () => parseBankCsv('date,amount,description\n2026-10-25,10,"Unclosed', mapping, "USD"),
    /unclosed quoted field/,
  );
});
