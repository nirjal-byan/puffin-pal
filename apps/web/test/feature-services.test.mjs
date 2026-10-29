import assert from "node:assert/strict";
import { test } from "node:test";
import "./helpers/hook-harness.mjs";

const { createSalaryStructure, loadEmployeeWorkspace, saveEmployee } =
  await import("../src/features/employees/services/employees-api.ts");
const { loadRecurringSchedule, loadRecurringWorkspace } =
  await import("../src/features/recurring-invoices/services/recurring-invoices-api.ts");

test("employee workspace loads members only for managers", async () => {
  const requests = [];
  const api = async (path) => {
    requests.push(path);
    if (path.startsWith("/employees")) return { items: [{ id: "employee-1" }] };
    if (path === "/departments") return [{ id: "department-1" }];
    if (path.startsWith("/members")) return [{ id: "member-1" }];
    throw new Error(`Unexpected request: ${path}`);
  };

  const managed = await loadEmployeeWorkspace(api, true);
  assert.equal(managed.members.length, 1);
  assert.ok(requests.includes("/members?limit=100&offset=0"));

  requests.length = 0;
  const restricted = await loadEmployeeWorkspace(api, false);
  assert.deepEqual(restricted.members, []);
  assert.equal(
    requests.some((path) => path.startsWith("/members")),
    false,
  );
});

test("employee create and edit preserve optional fields and optimistic concurrency", async () => {
  const calls = [];
  const api = async (path, options) => calls.push({ path, options });
  const values = {
    employeeCode: "EMP-1",
    firstName: "A",
    lastName: "Person",
    departmentId: "",
    managerId: "",
    linkedUserId: "",
    workEmail: "",
    phoneNumber: "",
  };

  await saveEmployee(api, values);
  await saveEmployee(api, values, { id: "employee-1", version: 7 });

  assert.equal(calls[0].path, "/employees");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body.departmentId, undefined);
  assert.deepEqual(calls[1], {
    path: "/employees/employee-1",
    options: {
      method: "PATCH",
      body: {
        ...values,
        departmentId: undefined,
        managerId: undefined,
        linkedUserId: undefined,
        workEmail: undefined,
        phoneNumber: undefined,
        expectedVersion: 7,
      },
    },
  });
});

test("salary creation carries the current structure version without changing values", async () => {
  let call;
  const api = async (path, options) => {
    call = { path, options };
  };
  await createSalaryStructure(
    api,
    "employee-1",
    "NPR",
    { effectiveFrom: "2026-11-01", effectiveTo: "", components: [] },
    4,
  );
  assert.deepEqual(call, {
    path: "/employees/employee-1/salary-structures",
    options: {
      method: "POST",
      body: {
        effectiveFrom: "2026-11-01",
        effectiveTo: undefined,
        components: [],
        currency: "NPR",
        expectedCurrentVersion: 4,
      },
    },
  });
});

test("recurring invoice workspace and history requests remain coordinated", async () => {
  const requests = [];
  const api = async (path) => {
    requests.push(path);
    if (path === "/recurring-invoices?limit=100&offset=0") return [{ id: "schedule-1" }];
    if (path === "/clients?limit=100&offset=0") return [{ id: "client-1" }];
    if (path === "/recurring-invoices/schedule-1") return { id: "schedule-1" };
    if (path === "/recurring-invoices/schedule-1/occurrences") return [{ id: "occurrence-1" }];
    throw new Error(`Unexpected request: ${path}`);
  };

  const workspace = await loadRecurringWorkspace(api);
  const detail = await loadRecurringSchedule(api, "schedule-1");
  assert.equal(workspace.schedules[0].id, "schedule-1");
  assert.equal(workspace.clients[0].id, "client-1");
  assert.equal(detail.schedule.id, "schedule-1");
  assert.equal(detail.occurrences[0].id, "occurrence-1");
  assert.deepEqual(requests, [
    "/recurring-invoices?limit=100&offset=0",
    "/clients?limit=100&offset=0",
    "/recurring-invoices/schedule-1",
    "/recurring-invoices/schedule-1/occurrences",
  ]);
});
