export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
export type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE" | "TERMINATED";

export interface Department {
  id: string;
  name: string;
  description?: string | null;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail?: string | null;
  phoneNumber?: string | null;
  jobTitle: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  hireDate: string;
  terminationDate?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  linkedUserId?: string | null;
  version: number;
  department?: Department | null;
  manager?: Pick<Employee, "id" | "firstName" | "lastName"> | null;
}

export interface SalaryComponent {
  id?: string;
  name: string;
  type: "EARNING" | "DEDUCTION";
  amount: string;
}

export interface SalaryStructure {
  id: string;
  compensationType: "FIXED_SALARY" | "HOURLY";
  baseAmount: string;
  currency: string;
  payFrequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY";
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  version: number;
  components: SalaryComponent[];
}

export interface MemberSummary {
  user: { id: string; fullName: string; email: string };
}

export interface EmployeeFormValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phoneNumber: string;
  jobTitle: string;
  employmentType: EmploymentType;
  status: Exclude<EmploymentStatus, "TERMINATED">;
  hireDate: string;
  departmentId: string;
  managerId: string;
  linkedUserId: string;
}

export interface SalaryFormValues {
  compensationType: "FIXED_SALARY" | "HOURLY";
  baseAmount: string;
  payFrequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY";
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
  components: SalaryComponent[];
}

export function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyEmployeeForm(): EmployeeFormValues {
  return {
    employeeCode: "",
    firstName: "",
    lastName: "",
    workEmail: "",
    phoneNumber: "",
    jobTitle: "",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    hireDate: currentDate(),
    departmentId: "",
    managerId: "",
    linkedUserId: "",
  };
}

export function employeeToForm(employee: Employee): EmployeeFormValues {
  return {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    workEmail: employee.workEmail ?? "",
    phoneNumber: employee.phoneNumber ?? "",
    jobTitle: employee.jobTitle,
    employmentType: employee.employmentType,
    status: employee.status === "TERMINATED" ? "INACTIVE" : employee.status,
    hireDate: employee.hireDate.slice(0, 10),
    departmentId: employee.departmentId ?? "",
    managerId: employee.managerId ?? "",
    linkedUserId: employee.linkedUserId ?? "",
  };
}

export function emptySalaryForm(): SalaryFormValues {
  return {
    compensationType: "FIXED_SALARY",
    baseAmount: "",
    payFrequency: "MONTHLY",
    effectiveFrom: currentDate(),
    effectiveTo: "",
    notes: "",
    components: [],
  };
}
