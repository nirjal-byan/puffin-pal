import "reflect-metadata";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PayrollPdfService } from "../dist/src/modules/payroll/payroll-pdf.service.js";
import { PayrollController } from "../dist/src/modules/payroll/payroll.controller.js";
import { REQUIRED_PERMISSIONS } from "../dist/src/common/decorators/auth.decorators.js";

const input = {
  runName: "October payroll",
  organizationName: "Meridian Advisory",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  paymentDate: "2026-11-01",
  currency: "NPR",
  employeeName: "Asha Rai",
  employeeCode: "EMP-004",
  departmentName: "Consulting",
  jobTitle: "Senior consultant",
  baseAmount: "80000.00",
  grossPay: "95000.00",
  totalDeductions: "3000.00",
  netPay: "92000.00",
  components: [
    { name: "Housing allowance", type: "EARNING", amount: "10000.00" },
    { name: "Transport allowance", type: "EARNING", amount: "5000.00" },
    { name: "Advance deduction", type: "DEDUCTION", amount: "3000.00" },
  ],
};

test("payslip is a bounded PDF rendered only from supplied snapshots", async (t) => {
  const buffer = await new PayrollPdfService().render(input);
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buffer.length < 250_000);
  const directory = mkdtempSync(join(tmpdir(), "puffinpal-payslip-test-"));
  const inputFile = join(directory, "input.pdf");
  const outputFile = join(directory, "output.txt");
  writeFileSync(inputFile, buffer);
  const extracted = spawnSync("pdftotext", ["-layout", inputFile, outputFile], { timeout: 10_000 });
  if (extracted.error?.code === "ENOENT") {
    rmSync(directory, { recursive: true, force: true });
    return t.skip("pdftotext is not installed");
  }
  assert.equal(extracted.status, 0, extracted.stderr.toString());
  const text = readFileSync(outputFile, "utf8");
  rmSync(directory, { recursive: true, force: true });
  for (const value of [
    "Meridian Advisory",
    "Asha Rai",
    "EMP-004",
    "Housing allowance",
    "NPR 92000.00",
  ])
    assert.ok(text.includes(value), `Missing ${value}`);
});

test("payroll routes declare payroll-specific permissions", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, PayrollController.prototype.get), [
    "payroll:read",
  ]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, PayrollController.prototype.approve), [
    "payroll:approve",
  ]);
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS, PayrollController.prototype.finalize),
    ["payroll:finalize"],
  );
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, PayrollController.prototype.payment), [
    "payroll:payments:record",
  ]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS, PayrollController.prototype.payslip), [
    "payroll:read",
  ]);
});
