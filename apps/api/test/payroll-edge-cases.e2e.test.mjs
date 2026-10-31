import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "temporal-polyfill";
import { createApplication } from "../dist/src/app.factory.js";
import { DATABASE } from "../dist/src/infrastructure/database/database.module.js";
import { PayrollAutomationProcessor } from "../dist/src/modules/payroll/payroll-automation.processor.js";
import { PayrollPayslipProcessor } from "../dist/src/modules/payroll/payroll-payslip.processor.js";
import { PayrollPdfService } from "../dist/src/modules/payroll/payroll-pdf.service.js";

const day = (value) => Temporal.Instant.from(`${value}T00:00:00Z`);

test("payroll edge cases preserve workforce, approval, automation, payslip and payment contracts", async () => {
  assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/puffinpal_auth_test_/);
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const db = app.get(DATABASE);
  async function request(path, token, body, method = "POST", expected = [200, 201]) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    const statuses = Array.isArray(expected) ? expected : [expected];
    assert.ok(statuses.includes(response.status), `${response.status}: ${JSON.stringify(value)}`);
    return value;
  }
  try {
    const password = "Payroll-edge-test-password-123";
    const owner = await request("/auth/signup", null, {
      organizationName: "Payroll edge QA",
      organizationSlug: "payroll-edge-qa",
      fullName: "Payroll owner",
      email: "owner@payroll-edge.test",
      password,
    });
    const token = owner.accessToken;
    const organizationId = owner.organization.id;
    await request("/members", token, {
      fullName: "Independent approver",
      email: "approver@payroll-edge.test",
      password,
      role: "ADMIN",
    });
    await request("/members", token, {
      fullName: "Read only payroll user",
      email: "viewer@payroll-edge.test",
      password,
      role: "FINANCE_VIEWER",
    });
    const approver = await request("/auth/login", null, {
      organizationSlug: "payroll-edge-qa",
      email: "approver@payroll-edge.test",
      password,
    });
    const viewer = await request("/auth/login", null, {
      organizationSlug: "payroll-edge-qa",
      email: "viewer@payroll-edge.test",
      password,
    });
    const employee = await request("/employees", token, {
      employeeCode: "EDGE-001",
      firstName: "Edge",
      lastName: "Employee",
      jobTitle: "QA analyst",
      employmentType: "FULL_TIME",
      hireDate: "2026-01-01",
    });
    const salary = await request(`/employees/${employee.id}/salary-structures`, token, {
      compensationType: "FIXED_SALARY",
      baseAmount: "3000.00",
      currency: "USD",
      payFrequency: "MONTHLY",
      effectiveFrom: "2026-01-01",
      components: [],
    });
    await request(
      "/workforce/settings",
      token,
      { timezone: "UTC", unpaidLeaveDeductionsEnabled: true },
      "PATCH",
    );
    const unpaidType = await request("/leave/types", token, {
      name: "Unpaid leave",
      code: "UNPAID",
      isPaid: false,
      requiresApproval: true,
      annualAllowanceUnits: 0,
    });
    const paidType = await request("/leave/types", token, {
      name: "Paid leave",
      code: "PAID",
      isPaid: true,
      requiresApproval: true,
      annualAllowanceUnits: 20,
    });
    const approvedOvertime = await request("/overtime/manage", token, {
      employeeId: employee.id,
      workDate: "2026-10-10",
      requestedMinutes: 120,
      reason: "Release support",
      hourlyRate: "20.00",
      multiplier: "1.50",
    });
    await db.orm.public.OvertimeRequest.where({ id: approvedOvertime.id }).update({
      status: "APPROVED",
      approvedMinutes: 60,
      approvedRateSnapshot: "20.00",
      version: 2,
    });
    await request(
      "/overtime/manage",
      token,
      {
        employeeId: employee.id,
        workDate: "2026-10-10",
        requestedMinutes: 30,
        reason: "Duplicate day",
        hourlyRate: "20.00",
        multiplier: "1.50",
      },
      "POST",
      409,
    );
    const rejectedOvertime = await request("/overtime/manage", token, {
      employeeId: employee.id,
      workDate: "2026-10-11",
      requestedMinutes: 60,
      reason: "Rejected overtime",
      hourlyRate: "20.00",
      multiplier: "1.50",
    });
    await db.orm.public.OvertimeRequest.where({ id: rejectedOvertime.id }).update({
      status: "REJECTED",
      version: 2,
    });
    const approvedLeave = await request("/leave/requests/manage", token, {
      employeeId: employee.id,
      leaveTypeId: unpaidType.id,
      startDate: "2026-10-12",
      endDate: "2026-10-12",
      dayPortion: "HALF_DAY",
      reason: "Half-day appointment",
    });
    await db.orm.public.LeaveRequest.where({ id: approvedLeave.id }).update({
      status: "APPROVED",
      version: 2,
    });
    const rejectedLeave = await request("/leave/requests/manage", token, {
      employeeId: employee.id,
      leaveTypeId: unpaidType.id,
      startDate: "2026-10-13",
      endDate: "2026-10-13",
      dayPortion: "FULL_DAY",
      reason: "Rejected request",
    });
    await db.orm.public.LeaveRequest.where({ id: rejectedLeave.id }).update({
      status: "REJECTED",
      version: 2,
    });
    const paidLeave = await request("/leave/requests/manage", token, {
      employeeId: employee.id,
      leaveTypeId: paidType.id,
      startDate: "2026-10-14",
      endDate: "2026-10-14",
      dayPortion: "FULL_DAY",
      reason: "Paid leave",
    });
    await db.orm.public.LeaveRequest.where({ id: paidLeave.id }).update({
      status: "APPROVED",
      version: 2,
    });

    let run = await request("/payroll/runs", token, {
      name: "October edge payroll",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      paymentDate: "2026-11-01",
    });
    run = await request(`/payroll/runs/${run.id}/calculate`, token, {
      expectedVersion: run.version,
      employeeIds: [employee.id],
    });
    let details = await request(`/payroll/runs/${run.id}`, token, undefined, "GET");
    const entry = details.entries[0];
    const review = await request(`/payroll/runs/${run.id}/workforce-review`, token, undefined, "GET");
    assert.equal(review.length, 1);
    assert.deepEqual(review[0].approvedOvertime.map((row) => row.id), [approvedOvertime.id]);
    assert.deepEqual(review[0].approvedUnpaidLeave.map((row) => row.id), [approvedLeave.id]);
    await request(
      `/payroll/runs/${run.id}/entries/${entry.id}/unpaid-leave`,
      token,
      { expectedVersion: run.version, leaveRequestId: rejectedLeave.id },
      "POST",
      409,
    );
    const beforeOvertimeVersion = run.version;
    run = await request(`/payroll/runs/${run.id}/entries/${entry.id}/overtime`, token, {
      expectedVersion: run.version,
      overtimeRequestId: approvedOvertime.id,
    });
    assert.equal(run.version, beforeOvertimeVersion + 1);
    await request(
      `/payroll/runs/${run.id}/entries/${entry.id}/overtime`,
      token,
      { expectedVersion: run.version, overtimeRequestId: approvedOvertime.id },
      "POST",
      409,
    );
    run = await request(`/payroll/runs/${run.id}/entries/${entry.id}/unpaid-leave`, token, {
      expectedVersion: run.version,
      leaveRequestId: approvedLeave.id,
    });
    details = await request(`/payroll/runs/${run.id}`, token, undefined, "GET");
    const overtimeComponent = details.entries[0].components.find(
      (component) => component.sourceOvertimeRequestId === approvedOvertime.id,
    );
    const leaveComponent = details.entries[0].components.find(
      (component) => component.sourceLeaveRequestId === approvedLeave.id,
    );
    assert.equal(String(overtimeComponent.amount), "30.00");
    assert.equal(leaveComponent.sourceMinutes, 240);
    assert.equal(Number(leaveComponent.amount) > 0, true);

    run = await request(`/payroll/runs/${run.id}/submit`, token, { expectedVersion: run.version });
    await request(
      `/payroll/runs/${run.id}/reject`,
      viewer.accessToken,
      { expectedVersion: run.version, reason: "Viewer must not reject" },
      "POST",
      403,
    );
    run = await request(`/payroll/runs/${run.id}/reject`, approver.accessToken, {
      expectedVersion: run.version,
      reason: "Correct the workforce inputs",
    });
    assert.equal(run.status, "DRAFT");
    assert.equal(run.rejectionReason, "Correct the workforce inputs");
    await request(
      `/payroll/runs/${run.id}/submit`,
      token,
      { expectedVersion: run.version - 1 },
      "POST",
      409,
    );
    run = await request(`/payroll/runs/${run.id}/entries/${entry.id}/adjustments`, token, {
      expectedVersion: run.version,
      type: "EARNING",
      name: "Revision correction",
      amount: "10.00",
    });
    run = await request(`/payroll/runs/${run.id}/submit`, token, { expectedVersion: run.version });
    run = await request(`/payroll/runs/${run.id}/approve`, approver.accessToken, {
      expectedVersion: run.version,
    });
    run = await request(`/payroll/runs/${run.id}/finalize`, approver.accessToken, {
      expectedVersion: run.version,
    });
    const audit = await db.orm.public.PayrollAuditEvent.where({
      organizationId,
      payrollRunId: run.id,
    }).all();
    assert.deepEqual(
      audit.map((row) => row.action),
      ["CREATED", "CALCULATED", "ADJUSTED", "ADJUSTED", "SUBMITTED", "REJECTED", "ADJUSTED", "SUBMITTED", "APPROVED", "FINALIZED"],
    );

    const firstPayment = {
      amount: "500.00",
      paymentDate: "2026-11-01",
      reference: "CONCURRENT-A",
      idempotencyKey: "concurrent-payment-a",
    };
    const secondPayment = {
      amount: "700.00",
      paymentDate: "2026-11-01",
      reference: "CONCURRENT-B",
      idempotencyKey: "concurrent-payment-b",
    };
    const concurrent = await Promise.all([
      request(`/payroll/runs/${run.id}/entries/${entry.id}/payments`, approver.accessToken, firstPayment),
      request(`/payroll/runs/${run.id}/entries/${entry.id}/payments`, approver.accessToken, secondPayment),
    ]);
    assert.equal(new Set(concurrent.map((payment) => payment.id)).size, 2);
    const replay = await request(
      `/payroll/runs/${run.id}/entries/${entry.id}/payments`,
      approver.accessToken,
      firstPayment,
    );
    assert.equal(replay.id, concurrent[0].id);
    await request(
      `/payroll/runs/${run.id}/entries/${entry.id}/payments`,
      approver.accessToken,
      { ...firstPayment, amount: "1.00", reference: "IDEMPOTENCY-CONFLICT" },
      "POST",
      409,
    );
    const afterPayments = await request(`/payroll/runs/${run.id}`, token, undefined, "GET");
    const outstanding = Number(afterPayments.entries[0].netPay) - 1200;
    await request(
      `/payroll/runs/${run.id}/entries/${entry.id}/payments`,
      approver.accessToken,
      {
        amount: (outstanding + 0.01).toFixed(2),
        paymentDate: "2026-11-01",
        reference: "OVERPAY",
        idempotencyKey: "overpayment-rejected",
      },
      "POST",
      400,
    );

    let stored;
    let storageAttempts = 0;
    const storage = {
      createKey: () => `payroll/${organizationId}/${run.id}/${entry.id}.pdf`,
      put: async (_key, buffer) => {
        storageAttempts += 1;
        if (storageAttempts === 1) throw new Error("Controlled object-storage failure");
        stored = buffer;
      },
      delete: async () => undefined,
    };
    const payslipProcessor = new PayrollPayslipProcessor(db, new PayrollPdfService(), storage);
    const job = {
      data: { organizationId, payrollRunId: run.id, payrollEntryId: entry.id, actorId: owner.user.id },
    };
    await assert.rejects(() => payslipProcessor.process(job), /Controlled object-storage failure/);
    let failedEntry = await db.orm.public.PayrollEntry.where({ id: entry.id }).first();
    assert.equal(failedEntry.payslipStatus, "FAILED");
    assert.equal(failedEntry.payslipFailureCode, "GENERATION_FAILED");
    await payslipProcessor.process(job);
    failedEntry = await db.orm.public.PayrollEntry.where({ id: entry.id }).first();
    assert.equal(failedEntry.payslipStatus, "COMPLETED");
    assert.equal(stored.subarray(0, 5).toString(), "%PDF-");

    const schedule = await request("/payroll/schedules", token, {
      name: "Edge monthly automation",
      frequency: "MONTHLY",
      timezone: "UTC",
      startDate: "2026-12-01",
      generationTime: "09:00",
      paymentOffsetDays: 1,
    });
    const occurrence = await db.orm.public.PayrollScheduleOccurrence.create({
      organizationId,
      scheduleId: schedule.id,
      periodStart: day("2026-12-01"),
      periodEnd: day("2026-12-31"),
      scheduledFor: Temporal.Now.instant(),
      source: "MANUAL",
    });
    const notifications = { notifyManagers: async () => undefined };
    const automation = new PayrollAutomationProcessor(
      db,
      { enqueue: async () => undefined },
      {},
      notifications,
    );
    await automation.generate(organizationId, occurrence.id);
    let generated = await db.orm.public.PayrollScheduleOccurrence.where({ id: occurrence.id }).first();
    assert.equal(generated.status, "GENERATED");
    const generatedRunId = generated.payrollRunId;
    await automation.generate(organizationId, occurrence.id);
    generated = await db.orm.public.PayrollScheduleOccurrence.where({ id: occurrence.id }).first();
    assert.equal(generated.payrollRunId, generatedRunId);
    assert.equal(
      (await db.orm.public.PayrollRun.where({ organizationId, payrollScheduleId: schedule.id }).all()).length,
      1,
    );
    await db.orm.public.PayrollSchedule.where({ id: schedule.id }).update({ status: "PAUSED" });
    const pausedOccurrence = await db.orm.public.PayrollScheduleOccurrence.create({
      organizationId,
      scheduleId: schedule.id,
      periodStart: day("2027-01-01"),
      periodEnd: day("2027-01-31"),
      scheduledFor: Temporal.Now.instant(),
      source: "MANUAL",
    });
    await automation.generate(organizationId, pausedOccurrence.id);
    assert.equal(
      (await db.orm.public.PayrollScheduleOccurrence.where({ id: pausedOccurrence.id }).first()).status,
      "PENDING",
    );
    await db.orm.public.PayrollSchedule.where({ id: schedule.id }).update({ status: "ACTIVE" });
    await db.orm.public.SalaryStructure.where({ id: salary.id }).update({ effectiveTo: day("2026-12-31") });
    await assert.rejects(() => automation.generate(organizationId, pausedOccurrence.id), /exactly one salary structure/i);
    const failedOccurrence = await db.orm.public.PayrollScheduleOccurrence.where({ id: pausedOccurrence.id }).first();
    assert.equal(failedOccurrence.status, "FAILED");
    assert.equal(failedOccurrence.failureCode, "GENERATION_FAILED");
  } finally {
    await app.close();
  }
});
