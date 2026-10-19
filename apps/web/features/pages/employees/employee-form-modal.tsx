import { AppModal } from "../../../components/app-modal";
import { DatePicker } from "../../../components/date-picker";
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
      wide
      onClose={onClose}
    >
      <form
        className="employee-form workforce-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="workforce-form-intro">
          <span className="workforce-form-icon" aria-hidden="true">
            ◎
          </span>
          <div>
            <strong>{employee ? "Update employee profile" : "Create an employee profile"}</strong>
            <p>Keep identity, contact, and reporting details in one place.</p>
          </div>
        </div>
        <section className="workforce-form-section">
          <div className="workforce-form-section-heading">
            <span>Personal details</span>
            <small>Basic employee information</small>
          </div>
          <div className="workforce-form-grid workforce-form-grid-3">
            <label>
              Employee code <small>Required</small>
              <input
                required
                placeholder="EMP-001"
                value={values.employeeCode}
                onChange={(event) => update("employeeCode", event.target.value)}
              />
            </label>
            <label>
              Job title <small>Required</small>
              <input
                required
                placeholder="Product designer"
                value={values.jobTitle}
                onChange={(event) => update("jobTitle", event.target.value)}
              />
            </label>
            <label>
              First name <small>Required</small>
              <input
                required
                placeholder="First name"
                value={values.firstName}
                onChange={(event) => update("firstName", event.target.value)}
              />
            </label>
            <label>
              Last name <small>Required</small>
              <input
                required
                placeholder="Last name"
                value={values.lastName}
                onChange={(event) => update("lastName", event.target.value)}
              />
            </label>
            <label>
              Work email <small>Optional</small>
              <input
                type="email"
                placeholder="name@company.com"
                value={values.workEmail}
                onChange={(event) => update("workEmail", event.target.value)}
              />
            </label>
            <label>
              Phone <small>Optional</small>
              <input
                placeholder="Work phone number"
                value={values.phoneNumber}
                onChange={(event) => update("phoneNumber", event.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="workforce-form-section">
          <div className="workforce-form-section-heading">
            <span>Employment</span>
            <small>Role, status, and reporting</small>
          </div>
          <div className="workforce-form-grid workforce-form-grid-3">
            <label>
              Employment type
              <select
                value={values.employmentType}
                onChange={(event) =>
                  update(
                    "employmentType",
                    event.target.value as EmployeeFormValues["employmentType"],
                  )
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
              <DatePicker
                value={values.hireDate}
                onChange={(hireDate) => update("hireDate", hireDate)}
                ariaLabel="Employee hire date"
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
        </section>
        <div className="workforce-form-actions">
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
