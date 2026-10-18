import type { Department, Employee } from "./types";

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
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">All statuses</option>
            {["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"].map((value) => (
              <option key={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </select>
          <select
            aria-label="Filter by department"
            value={departmentId}
            onChange={(event) => onDepartmentChange(event.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
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
