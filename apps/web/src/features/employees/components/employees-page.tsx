"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import {
  createSalaryStructure,
  loadEmployee,
  loadSalaryStructures,
  saveEmployee,
} from "../services/employees-api";
import { useEmployeeDirectory } from "../hooks/use-employee-directory";
import { EmployeeDirectory } from "./employee-directory";
import { EmployeePageDialogs } from "./employee-page-dialogs";
import {
  currentDate,
  employeeToForm,
  emptyEmployeeForm,
  emptySalaryForm,
  type Department,
  type Employee,
  type EmployeeFormValues,
  type SalaryFormValues,
  type SalaryStructure,
} from "../types/employee.types";

interface EmployeesPageProps {
  api: WorkspaceApi;
  currency: string;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}

export default function EmployeesPage({ api, currency, permissions, onSaved }: EmployeesPageProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | "new" | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormValues>(emptyEmployeeForm);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [salaryForm, setSalaryForm] = useState<SalaryFormValues>(emptySalaryForm);
  const [isSalaryFormOpen, setIsSalaryFormOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isTerminationOpen, setIsTerminationOpen] = useState(false);
  const [terminationDate, setTerminationDate] = useState(currentDate());
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );
  const canManageEmployees = can("employees:manage");
  const {
    employees,
    departments,
    members,
    error,
    setError,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    filteredEmployees,
    refresh: refreshWorkspace,
  } = useEmployeeDirectory(api, canManageEmployees);

  function openEmployeeForm(employee?: Employee) {
    setEditingEmployee(employee ?? "new");
    setEmployeeForm(employee ? employeeToForm(employee) : emptyEmployeeForm());
  }

  async function handleEmployeeSubmit() {
    const employee = editingEmployee === "new" ? undefined : (editingEmployee ?? undefined);
    setIsSaving(true);
    setError("");
    try {
      await saveEmployee(api, employeeForm, employee);
      setEditingEmployee(null);
      await refreshWorkspace();
      onSaved(employee ? "Employee updated." : "Employee created.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEmployeeSelect(employee: Employee) {
    setError("");
    try {
      const [details, salaries] = await Promise.all([
        loadEmployee(api, employee.id),
        can("salaries:read") ? loadSalaryStructures(api, employee.id) : Promise.resolve([]),
      ]);
      setSelectedEmployee(details);
      setSalaryStructures(salaries);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function handleSalarySubmit() {
    if (!selectedEmployee) return;
    setIsSaving(true);
    setError("");
    try {
      const currentSalary = salaryStructures.find((salary) => !salary.effectiveTo);
      await createSalaryStructure(
        api,
        selectedEmployee.id,
        currency,
        salaryForm,
        currentSalary?.version,
      );
      setSalaryStructures(await loadSalaryStructures(api, selectedEmployee.id));
      setSalaryForm(emptySalaryForm());
      setIsSalaryFormOpen(false);
      onSaved("Salary structure added.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDepartmentSave(name: string, department?: Department) {
    setIsSaving(true);
    setError("");
    try {
      await api(department ? `/departments/${department.id}` : "/departments", {
        method: department ? "PATCH" : "POST",
        body: { name },
      });
      await refreshWorkspace();
      onSaved(department ? "Department renamed." : "Department created.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDepartmentDelete() {
    if (!departmentToDelete) return;
    setIsSaving(true);
    setError("");
    try {
      await api(`/departments/${departmentToDelete.id}`, { method: "DELETE" });
      setDepartmentToDelete(null);
      await refreshWorkspace();
      onSaved("Department deleted.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTermination() {
    if (!selectedEmployee) return;
    setIsSaving(true);
    setError("");
    try {
      await api(`/employees/${selectedEmployee.id}/terminate`, {
        method: "POST",
        body: { expectedVersion: selectedEmployee.version, terminationDate },
      });
      setIsTerminationOpen(false);
      setSelectedEmployee(null);
      await refreshWorkspace();
      onSaved("Employee terminated.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <EmployeeDirectory
        employees={filteredEmployees}
        departments={departments}
        search={search}
        status={statusFilter}
        departmentId={departmentFilter}
        canCreate={can("employees:create")}
        canUpdate={can("employees:update")}
        canManage={canManageEmployees}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onDepartmentChange={setDepartmentFilter}
        onCreate={() => openEmployeeForm()}
        onEdit={openEmployeeForm}
        onSelect={(employee) => void handleEmployeeSelect(employee)}
        onManageDepartments={() => setIsDepartmentModalOpen(true)}
      />

      {error && (
        <p className="alert" role="alert">
          {error}
          <button className="text-button" onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </p>
      )}

      <EmployeePageDialogs
        currency={currency}
        employees={employees}
        departments={departments}
        members={members}
        editingEmployee={editingEmployee}
        employeeForm={employeeForm}
        selectedEmployee={selectedEmployee}
        salaryStructures={salaryStructures}
        salaryForm={salaryForm}
        isSalaryFormOpen={isSalaryFormOpen}
        isDepartmentModalOpen={isDepartmentModalOpen}
        isTerminationOpen={isTerminationOpen}
        terminationDate={terminationDate}
        departmentToDelete={departmentToDelete}
        isSaving={isSaving}
        canManageEmployees={canManageEmployees}
        canReadSalary={can("salaries:read")}
        canManageSalary={can("salaries:manage")}
        onEmployeeFormChange={setEmployeeForm}
        onEmployeeSubmit={() => void handleEmployeeSubmit()}
        onCloseEmployeeForm={() => setEditingEmployee(null)}
        onCloseEmployeeDetails={() => setSelectedEmployee(null)}
        onOpenTermination={() => setIsTerminationOpen(true)}
        onOpenSalary={() => {
          setSalaryForm(emptySalaryForm());
          setIsSalaryFormOpen(true);
        }}
        onSalaryFormChange={setSalaryForm}
        onSalarySubmit={() => void handleSalarySubmit()}
        onCloseSalary={() => setIsSalaryFormOpen(false)}
        onDepartmentSave={(name, department) => void handleDepartmentSave(name, department)}
        onDepartmentDelete={(department) => {
          setIsDepartmentModalOpen(false);
          setDepartmentToDelete(department);
        }}
        onCloseDepartments={() => setIsDepartmentModalOpen(false)}
        onTerminationDateChange={setTerminationDate}
        onTerminationConfirm={() => void handleTermination()}
        onCloseTermination={() => setIsTerminationOpen(false)}
        onDepartmentDeleteConfirm={() => void handleDepartmentDelete()}
        onCloseDepartmentDelete={() => setDepartmentToDelete(null)}
      />
    </>
  );
}
