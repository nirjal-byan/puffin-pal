import { AppModal } from "../../../components/app-modal";
import type { Department, Employee, EmployeeFormValues, MemberSummary } from "./types";

interface EmployeeFormModalProps {
  employee?: Employee;
  values: EmployeeFormValues;
  employees: Employee[];
  departments: Department[];
  members: MemberSummary[];
  isSaving: boolean;
  onChange: (values: EmployeeFormValues) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function EmployeeFormModal({
  employee,
  values,
  employees,
  departments,
  members,
  isSaving,
  onChange,
  onSubmit,
  onClose,
}: EmployeeFormModalProps) {
  const update = <Key extends keyof EmployeeFormValues>(key: Key, value: EmployeeFormValues[Key]) =>
    onChange({ ...values, [key]: value });

  return (
    <AppModal
      title={employee ? "Edit employee" : "Add employee"}
      badge="Employee"
      onClose={onClose}
    >
      <form
        className="employee-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="form-grid">
          <label>
            Employee code
            <input
              required
              value={values.employeeCode}
              onChange={(event) => update("employeeCode", event.target.value)}
            />
          </label>
          <label>
            Job title
            <input
              required
              value={values.jobTitle}
              onChange={(event) => update("jobTitle", event.target.value)}
            />
          </label>
          <label>
            First name
            <input
              required
              value={values.firstName}
              onChange={(event) => update("firstName", event.target.value)}
            />
          </label>
          <label>
            Last name
            <input
              required
              value={values.lastName}
              onChange={(event) => update("lastName", event.target.value)}
            />
          </label>
          <label>
            Work email
            <input
              type="email"
              value={values.workEmail}
              onChange={(event) => update("workEmail", event.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              value={values.phoneNumber}
              onChange={(event) => update("phoneNumber", event.target.value)}
            />
          </label>
          <label>
            Employment type
            <select
              value={values.employmentType}
              onChange={(event) =>
                update("employmentType", event.target.value as EmployeeFormValues["employmentType"])
              }
            >
              {["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={values.status}
              onChange={(event) =>
                update("status", event.target.value as EmployeeFormValues["status"])
              }
            >
              {["ACTIVE", "ON_LEAVE", "INACTIVE"].map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hire date
            <input
              type="date"
              required
              value={values.hireDate}
              onChange={(event) => update("hireDate", event.target.value)}
            />
          </label>
          <label>
            Department
            <select
              value={values.departmentId}
              onChange={(event) => update("departmentId", event.target.value)}
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Manager
            <select
              value={values.managerId}
              onChange={(event) => update("managerId", event.target.value)}
            >
              <option value="">No manager</option>
              {employees
                .filter((candidate) => candidate.id !== employee?.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.firstName} {candidate.lastName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Linked account
            <select
              value={values.linkedUserId}
              onChange={(event) => update("linkedUserId", event.target.value)}
            >
              <option value="">No account</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.fullName} · {member.user.email}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save employee"}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
