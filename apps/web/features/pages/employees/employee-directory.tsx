import type { Department, Employee } from "./types";
import { Dropdown } from "../../../components/dropdown";

interface EmployeeDirectoryProps {
  employees: Employee[];
  departments: Department[];
  search: string;
  status: string;
  departmentId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canManage: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (employee: Employee) => void;
  onSelect: (employee: Employee) => void;
  onManageDepartments: () => void;
}

export function EmployeeDirectory({
  employees,
  departments,
  search,
  status,
  departmentId,
  canCreate,
  canUpdate,
  canManage,
  onSearchChange,
  onStatusChange,
  onDepartmentChange,
  onCreate,
  onEdit,
  onSelect,
  onManageDepartments,
}: EmployeeDirectoryProps) {
  return (
    <>
      <section className="panel employee-toolbar">
        <div className="employee-filters">
          <input
            aria-label="Search employees"
            placeholder="Search name, code or role"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <Dropdown
            name="employee-status-filter"
            label="Filter by status"
            searchable={false}
            value={status}
            onChange={onStatusChange}
            options={[
              { value: "", label: "All statuses" },
              ...["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"].map((value) => ({
                value,
                label: value.replaceAll("_", " "),
              })),
            ]}
          />
          <Dropdown
            name="employee-department-filter"
            label="Filter by department"
            value={departmentId}
            onChange={onDepartmentChange}
            options={[
              { value: "", label: "All departments" },
              ...departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
          />
        </div>
        <div className="row-actions">
          {canManage && (
            <button className="button secondary" onClick={onManageDepartments}>
              Departments
            </button>
          )}
          {canCreate && (
            <button className="button primary" onClick={onCreate}>
              + Employee
            </button>
          )}
        </div>
      </section>

      <section className="panel" data-tour="employee-list">
        <div className="panel-heading">
          <h3>Employee directory</h3>
          <span className="muted">{employees.length} employees</span>
        </div>
        {employees.length === 0 ? (
          <div className="empty-state">
            <span className="empty-symbol">♙</span>
            <h3>No employees found</h3>
            <p>Add an employee or adjust your filters.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Manager</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <button className="employee-name" onClick={() => onSelect(employee)}>
                        <strong>
                          {employee.firstName} {employee.lastName}
                        </strong>
                        <small>
                          {employee.employeeCode}
                          {employee.workEmail ? ` · ${employee.workEmail}` : ""}
                        </small>
                      </button>
                    </td>
                    <td>
                      {employee.jobTitle}
                      <small className="muted employee-subtitle">
                        {employee.employmentType.replaceAll("_", " ")}
                      </small>
                    </td>
                    <td>{employee.department?.name ?? "—"}</td>
                    <td>
                      {employee.manager
                        ? `${employee.manager.firstName} ${employee.manager.lastName}`
                        : "—"}
                    </td>
                    <td>
                      <span className={`status-badge status-${employee.status.toLowerCase()}`}>
                        {employee.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      {canUpdate && employee.status !== "TERMINATED" && (
                        <button className="text-button" onClick={() => onEdit(employee)}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
