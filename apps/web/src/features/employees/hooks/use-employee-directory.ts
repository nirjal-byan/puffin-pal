import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage, type WorkspaceApi } from "@/lib/api";
import { loadEmployeeWorkspace } from "../services/employees-api";
import type { Department, Employee, MemberSummary } from "../types/employee.types";

export function useEmployeeDirectory(api: WorkspaceApi, canManageEmployees: boolean) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const apply = (data: {
    employees: Employee[];
    departments: Department[];
    members: MemberSummary[];
  }) => {
    setEmployees(data.employees);
    setDepartments(data.departments);
    setMembers(data.members);
  };
  const refresh = useCallback(
    async () => apply(await loadEmployeeWorkspace(api, canManageEmployees)),
    [api, canManageEmployees],
  );
  useEffect(() => {
    let active = true;
    loadEmployeeWorkspace(api, canManageEmployees)
      .then((data) => {
        if (active) apply(data);
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
  return {
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
    refresh,
  };
}
