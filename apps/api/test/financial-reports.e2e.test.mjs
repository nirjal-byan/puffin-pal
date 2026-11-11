import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "temporal-polyfill";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";

test("financial reports aggregate authoritative tenant records without cross-tenant leakage", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const db = app.get(DATABASE);
  async function request(path, token, body, method = "POST", expected = 200) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    return value;
  }
  try {
    const password = "Financial-report-password-123";
    const owner = await request(
      "/auth/signup",
      null,
      {
        organizationName: "Reports",
        organizationSlug: "reports-owner",
        fullName: "Owner",
        email: "owner@reports.test",
        password,
      },
      "POST",
      201,
    );
    const other = await request(
      "/auth/signup",
      null,
      {
        organizationName: "Other",
        organizationSlug: "reports-other",
        fullName: "Other",
        email: "other@reports.test",
        password,
      },
      "POST",
      201,
    );
    const day = Temporal.PlainDate.from("2026-06-15");
    const instant = Temporal.Instant.from(`${day}T00:00:00Z`);
    const client = await db.orm.public.Client.create({
      organizationId: owner.organization.id,
      name: "Report client",
      email: "client@reports.test",
    });
    const invoice = await db.orm.public.Invoice.create({
      organizationId: owner.organization.id,
      clientId: client.id,
      invoiceNumber: "REPORT-1",
      status: "ISSUED",
      issueDate: instant,
      dueDate: Temporal.Instant.from("2026-06-20T00:00:00Z"),
      issuedAt: instant,
      subtotal: "100.00",
      tax: "0.00",
      total: "100.00",
      currency: "USD",
    });
    await db.orm.public.Payment.create({
      organizationId: owner.organization.id,
      invoiceId: invoice.id,
      amount: "25.00",
      paymentDate: instant,
      method: "BANK_TRANSFER",
      recordedByUserId: owner.user.id,
    });
    const expense = await db.orm.public.Expense.create({
      organizationId: owner.organization.id,
      title: "Approved cost",
      amount: "10.00",
      category: "SOFTWARE",
      date: instant,
      approvalStatus: "APPROVED",
      createdByUserId: owner.user.id,
    });
    await db.orm.public.Expense.create({
      organizationId: owner.organization.id,
      title: "Rejected cost",
      amount: "99.00",
      category: "OTHER",
      date: instant,
      approvalStatus: "REJECTED",
      createdByUserId: owner.user.id,
    });
    const vendor = await db.orm.public.Vendor.create({
      organizationId: owner.organization.id,
      name: "Report vendor",
      defaultCurrency: "USD",
      paymentTermsDays: 30,
    });
    const bill = await db.orm.public.VendorBill.create({
      organizationId: owner.organization.id,
      vendorId: vendor.id,
      expenseId: expense.id,
      billNumber: "BILL-1",
      issueDate: instant,
      dueDate: Temporal.Instant.from("2026-06-10T00:00:00Z"),
      currency: "USD",
      subtotal: "10.00",
      totalAmount: "10.00",
      status: "APPROVED",
      createdById: owner.user.id,
    });
    const linkedPayment = await db.orm.public.PayablePayment.create({
      organizationId: owner.organization.id,
      targetType: "VENDOR_BILL",
      vendorBillId: bill.id,
      amount: "4.00",
      currency: "USD",
      paymentDate: instant,
      method: "BANK_TRANSFER",
      idempotencyKey: "report-payment-1",
      recordedById: owner.user.id,
    });
    const query = "from=2026-06-01&to=2026-06-30&currency=USD&groupBy=month";
    const report = await request(
      `/financial-reports/overview?${query}`,
      owner.accessToken,
      undefined,
      "GET",
    );
    assert.equal(report.revenue.issued, "100.00");
    assert.equal(report.revenue.collected, "25.00");
    assert.equal(report.revenue.outstanding, "75.00");
    assert.equal(report.expenses.approved, "10.00");
    assert.equal(report.expenses.paid, "4.00");
    assert.equal(report.expenses.unpaid, "6.00");
    assert.equal(report.profitability.profit, "90.00");
    assert.equal(report.payables.available, true);
    assert.equal(report.payables.outstanding, "6.00");
    assert.equal(report.payables.payments, "4.00");
    assert.equal(report.cashMovement.outflows, "4.00");
    const dashboard = await request("/dashboard/financial-summary?from=2026-06-01&to=2026-06-30", owner.accessToken, undefined, "GET");
    assert.equal(dashboard.metrics.cashOutflows, "4.00");
    assert.equal(dashboard.metrics.netCashFlow, "21.00");
    assert.equal(dashboard.metrics.expenses, "10.00");
    assert.equal(dashboard.metrics.outstandingPayables, "6.00");
    assert.equal(dashboard.attention.unpaidBills, 1);
    assert.equal(dashboard.attention.unsettledExpenses, 0); // linked cost belongs to its bill
    assert.equal(dashboard.trend.reduce((sum, p) => sum + Number(p.outflows), 0), 4);
    const clipped = await request("/dashboard/financial-summary?from=2026-06-16&to=2026-08-01", owner.accessToken, undefined, "GET");
    assert.equal(clipped.range.granularity, "week");
    assert.equal(clipped.trend[0].date, "2026-06-16");
    assert.equal(clipped.trend.reduce((sum, p) => sum + Number(p.collections) + Number(p.expenses) + Number(p.revenue) + Number(p.outflows), 0), 0);
    const emptyDashboard = await request("/dashboard/financial-summary?from=2026-06-01&to=2026-06-30", other.accessToken, undefined, "GET");
    assert.equal(emptyDashboard.metrics.netCashFlow, "0.00");
    assert.equal(emptyDashboard.attention.unpaidBills, 0);
    assert.ok(emptyDashboard.aging.every((bucket) => bucket.count === 0));
    const isolated = await request(
      `/financial-reports/overview?${query}`,
      other.accessToken,
      undefined,
      "GET",
    );
    assert.equal(isolated.revenue.issued, "0.00");
    assert.equal(isolated.expenses.approved, "0.00");
    const settlement = await request(`/expenses/${expense.id}/settlement`, owner.accessToken, undefined, "GET");
    assert.equal(settlement.linkedBill.id, bill.id);
    assert.equal(settlement.balance, "6.00");
    await request(`/accounts-payable/payments/${linkedPayment.id}/reverse`, owner.accessToken, { expectedVersion: linkedPayment.version, reason: "Report reversal verification" }, "POST");
    const reversed = await request(`/financial-reports/overview?${query}`, owner.accessToken, undefined, "GET");
    assert.equal(reversed.expenses.approved, "10.00");
    assert.equal(reversed.expenses.paid, "0.00");
    assert.equal(reversed.expenses.unpaid, "10.00");
    assert.equal(reversed.payables.outstanding, "10.00");
    assert.equal(reversed.cashMovement.outflows, "0.00");
    const eur = await request(`/financial-reports/overview?${query.replace("currency=USD", "currency=EUR")}`, owner.accessToken, undefined, "GET");
    assert.equal(eur.expenses.approved, "0.00");
    const history = await request(`/expenses/${expense.id}/settlement`, owner.accessToken, undefined, "GET");
    assert.equal(history.balance, "10.00");
    assert.ok(history.payments[0].reversedAt);

    const reversedDashboard = await request("/dashboard/financial-summary?from=2026-06-01&to=2026-06-30", owner.accessToken, undefined, "GET");
    assert.equal(reversedDashboard.metrics.netCashFlow, "25.00");
    assert.equal(reversedDashboard.metrics.outstandingPayables, "10.00");

    const standalone = await db.orm.public.Expense.create({ organizationId: owner.organization.id, title: "Standalone", amount: "5.00", category: "OTHER", date: instant, approvalStatus: "APPROVED", createdByUserId: owner.user.id });
    await db.orm.public.PayablePayment.create({ organizationId: owner.organization.id, targetType: "EXPENSE", expenseId: standalone.id, amount: "1.50", currency: "USD", paymentDate: instant, method: "CASH", idempotencyKey: "standalone-dashboard", recordedById: owner.user.id });
    const employee = await db.orm.public.Employee.create({ organizationId: owner.organization.id, employeeCode: "DASH-1", firstName: "Dash", lastName: "Employee", jobTitle: "Test", employmentType: "FULL_TIME", hireDate: instant });
    const salary = await db.orm.public.SalaryStructure.create({ organizationId: owner.organization.id, employeeId: employee.id, effectiveFrom: instant, compensationType: "FIXED_SALARY", payFrequency: "MONTHLY", currency: "USD", baseAmount: "20.00", createdById: owner.user.id });
    const run = await db.orm.public.PayrollRun.create({ organizationId: owner.organization.id, name: "Dashboard run", periodStart: instant, periodEnd: instant, paymentDate: instant, status: "FINALIZED", currency: "USD", organizationName: "Reports", totalGross: "20.00", totalNet: "20.00", createdById: owner.user.id });
    const entry = await db.orm.public.PayrollEntry.create({ organizationId: owner.organization.id, payrollRunId: run.id, employeeId: employee.id, salaryStructureId: salary.id, employeeName: "Dash Employee", employeeCode: "DASH-1", jobTitle: "Test", compensationType: "FIXED_SALARY", payFrequency: "MONTHLY", baseAmount: "20.00", grossPay: "20.00", totalDeductions: "0.00", netPay: "20.00" });
    await db.orm.public.PayrollEntryComponent.create({ organizationId: owner.organization.id, payrollEntryId: entry.id, name: "Employer contribution", type: "EMPLOYER_CONTRIBUTION", amount: "2.00" });
    await db.orm.public.PayrollPayment.create({ organizationId: owner.organization.id, payrollEntryId: entry.id, amount: "3.00", paymentDate: instant, reference: "Dashboard", idempotencyKey: "dashboard-payroll", recordedById: owner.user.id });
    const foreignInvoice = await db.orm.public.Invoice.create({ organizationId: owner.organization.id, clientId: client.id, invoiceNumber: "REPORT-EUR", status: "ISSUED", issueDate: instant, dueDate: instant, issuedAt: instant, subtotal: "1000.00", tax: "0.00", total: "1000.00", currency: "EUR" });
    await db.orm.public.Payment.create({ organizationId: owner.organization.id, invoiceId: foreignInvoice.id, amount: "100.00", paymentDate: instant, method: "BANK_TRANSFER", recordedByUserId: owner.user.id });
    const finalDashboard = await request("/dashboard/financial-summary?from=2026-06-01&to=2026-06-30", owner.accessToken, undefined, "GET");
    assert.equal(finalDashboard.metrics.paymentsReceived, "25.00");
    assert.equal(finalDashboard.metrics.cashOutflows, "4.50");
    assert.equal(finalDashboard.metrics.netCashFlow, "20.50");
    assert.equal(finalDashboard.attention.unsettledExpenses, 1);
    assert.equal(finalDashboard.attention.unsettledExpenseAmount, "3.50");
    const finalReport = await request(`/financial-reports/overview?${query}`, owner.accessToken, undefined, "GET");
    assert.equal(finalReport.profitability.operatingCosts, "37.00");
    assert.equal(finalReport.trend[0].payroll, "20.00");
    assert.equal(finalReport.trend[0].employerContributions, "2.00");
    assert.equal(finalReport.trend[0].profit, finalReport.profitability.profit);
    assert.equal(finalReport.cashMovement.net, finalDashboard.metrics.netCashFlow);

  } finally {
    await app.close();
  }
});
