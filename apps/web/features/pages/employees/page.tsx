"use client";

import type { Permission } from "@puffinpal/permissions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, type WorkspaceApi } from "../../../lib/api";
import {
  createSalaryStructure,
  loadEmployee,
  loadEmployeeWorkspace,
  loadSalaryStructures,
  saveEmployee,
} from "./api";
import { EmployeeDirectory } from "./employee-directory";
import { EmployeeFormModal } from "./employee-form-modal";
import {
  ConfirmationModal,
  DepartmentModal,
  EmployeeDetailsModal,
  SalaryFormModal,
} from "./employee-management-modals";
import {
  currentDate,
  employeeToForm,
  emptyEmployeeForm,
  emptySalaryForm,
  type Department,
  type Employee,
  type EmployeeFormValues,
  type MemberSummary,
  type SalaryFormValues,
  type SalaryStructure,
} from "./types";

interface EmployeesPageProps {
  api: WorkspaceApi;
  currency: string;
  permissions: readonly Permission[];
  onSaved: (message: string) => void;
}

export default function EmployeesPage({ api, currency, permissions, onSaved }: EmployeesPageProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
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

  const refreshWorkspace = useCallback(async () => {
    const data = await loadEmployeeWorkspace(api, canManageEmployees);
    setEmployees(data.employees);
    setDepartments(data.departments);
    setMembers(data.members);
  }, [api, canManageEmployees]);

  useEffect(() => {
    let active = true;
    loadEmployeeWorkspace(api, canManageEmployees)
      .then((data) => {
        if (!active) return;
        setEmployees(data.employees);
        setDepartments(data.departments);
        setMembers(data.members);
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [api, canManageEmployees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const text = [employee.employeeCode, employee.firstName, employee.lastName, employee.jobTitle]
        .join(" ")
        .toLowerCase();
      return (
        (!query || text.includes(query)) &&
        (!statusFilter || employee.status === statusFilter) &&
        (!departmentFilter || employee.departmentId === departmentFilter)
      );
    });
  }, [departmentFilter, employees, search, statusFilter]);

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

      {editingEmployee && (
        <EmployeeFormModal
          employee={editingEmployee === "new" ? undefined : editingEmployee}
          values={employeeForm}
          employees={employees}
          departments={departments}
          members={members}
          isSaving={isSaving}
          onChange={setEmployeeForm}
          onSubmit={() => void handleEmployeeSubmit()}
          onClose={() => setEditingEmployee(null)}
        />
      )}

      {selectedEmployee && !isTerminationOpen && !isSalaryFormOpen && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          salaryStructures={salaryStructures}
          currency={currency}
          canManage={canManageEmployees}
          canReadSalary={can("salaries:read")}
          canManageSalary={can("salaries:manage")}
          onTerminate={() => setIsTerminationOpen(true)}
          onAddSalary={() => {
            setSalaryForm(emptySalaryForm());
            setIsSalaryFormOpen(true);
          }}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {isSalaryFormOpen && (
        <SalaryFormModal
          values={salaryForm}
          currency={currency}
          isSaving={isSaving}
          onChange={setSalaryForm}
          onSubmit={() => void handleSalarySubmit()}
          onClose={() => setIsSalaryFormOpen(false)}
        />
      )}

      {isDepartmentModalOpen && (
        <DepartmentModal
          departments={departments}
          isSaving={isSaving}
          onSave={(name, department) => void handleDepartmentSave(name, department)}
          onDelete={(department) => {
            setIsDepartmentModalOpen(false);
            setDepartmentToDelete(department);
          }}
          onClose={() => setIsDepartmentModalOpen(false)}
        />
      )}

      {isTerminationOpen && selectedEmployee && (
        <ConfirmationModal
          title="Terminate employment"
          message={`End employment for ${selectedEmployee.firstName} ${selectedEmployee.lastName}? Their history will be retained.`}
          confirmLabel="Terminate employee"
          danger
          isSaving={isSaving}
          onConfirm={() => void handleTermination()}
          onClose={() => setIsTerminationOpen(false)}
        >
          <label>
            Termination date
            <input
              type="date"
              min={selectedEmployee.hireDate.slice(0, 10)}
              value={terminationDate}
              onChange={(event) => setTerminationDate(event.target.value)}
            />
          </label>
        </ConfirmationModal>
      )}

      {departmentToDelete && (
        <ConfirmationModal
          title="Delete department"
          message={`Delete ${departmentToDelete.name}? Assigned employees must be moved first.`}
          confirmLabel="Delete department"
          danger
          isSaving={isSaving}
          onConfirm={() => void handleDepartmentDelete()}
          onClose={() => setDepartmentToDelete(null)}
        />
      )}
    </>
  );
}
