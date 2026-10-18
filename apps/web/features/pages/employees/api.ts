import type { WorkspaceApi } from "../../../lib/api";
import type {
  Department,
  Employee,
  EmployeeFormValues,
  MemberSummary,
  SalaryFormValues,
  SalaryStructure,
} from "./types";

export async function loadEmployeeWorkspace(api: WorkspaceApi, includeMembers: boolean) {
  const [employeeResponse, departments, members] = await Promise.all([
    api<{ items: Employee[] }>("/employees?limit=100&offset=0"),
    api<Department[]>("/departments"),
    includeMembers ? api<MemberSummary[]>("/members?limit=100&offset=0") : Promise.resolve([]),
  ]);

  return { employees: employeeResponse.items, departments, members };
}

export function saveEmployee(api: WorkspaceApi, values: EmployeeFormValues, employee?: Employee) {
  const body = {
    ...values,
    departmentId: values.departmentId || undefined,
    managerId: values.managerId || undefined,
    linkedUserId: values.linkedUserId || undefined,
    workEmail: values.workEmail || undefined,
    phoneNumber: values.phoneNumber || undefined,
    ...(employee ? { expectedVersion: employee.version } : {}),
  };

  return api(employee ? `/employees/${employee.id}` : "/employees", {
    method: employee ? "PATCH" : "POST",
    body,
  });
}

export function loadEmployee(api: WorkspaceApi, employeeId: string) {
  return api<Employee>(`/employees/${employeeId}`);
}

export function loadSalaryStructures(api: WorkspaceApi, employeeId: string) {
  return api<SalaryStructure[]>(`/employees/${employeeId}/salary-structures`);
}

export function createSalaryStructure(
  api: WorkspaceApi,
  employeeId: string,
  currency: string,
  values: SalaryFormValues,
  currentVersion?: number,
) {
  return api(`/employees/${employeeId}/salary-structures`, {
    method: "POST",
    body: {
      ...values,
      currency,
      effectiveTo: values.effectiveTo || undefined,
      expectedCurrentVersion: currentVersion,
    },
  });
}
