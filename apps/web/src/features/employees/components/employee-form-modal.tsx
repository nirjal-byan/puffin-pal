import { FormModal } from "@/components/ui/form-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import type {
  Department,
  Employee,
  EmployeeFormValues,
  MemberSummary,
} from "../types/employee.types";

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
    <FormModal
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
              <Dropdown
                name="employee-employment-type"
                label="Employment type"
                searchable={false}
                value={values.employmentType}
                onChange={(employmentType) =>
                  update("employmentType", employmentType as EmployeeFormValues["employmentType"])
                }
                options={["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].map((value) => ({
                  value,
                  label: value.replaceAll("_", " "),
                }))}
              />
            </label>
            <label>
              Status
              <Dropdown
                name="employee-status"
                label="Employee status"
                searchable={false}
                value={values.status}
                onChange={(status) => update("status", status as EmployeeFormValues["status"])}
                options={["ACTIVE", "ON_LEAVE", "INACTIVE"].map((value) => ({
                  value,
                  label: value.replaceAll("_", " "),
                }))}
              />
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
              <Dropdown
                name="employee-department"
                label="Department"
                value={values.departmentId}
                onChange={(departmentId) => update("departmentId", departmentId)}
                options={[
                  { value: "", label: "No department" },
                  ...departments.map((department) => ({
                    value: department.id,
                    label: department.name,
                  })),
                ]}
              />
            </label>
            <label>
              Manager
              <Dropdown
                name="employee-manager"
                label="Manager"
                value={values.managerId}
                onChange={(managerId) => update("managerId", managerId)}
                options={[
                  { value: "", label: "No manager" },
                  ...employees
                    .filter((candidate) => candidate.id !== employee?.id)
                    .map((candidate) => ({
                      value: candidate.id,
                      label: `${candidate.firstName} ${candidate.lastName}`,
                    })),
                ]}
              />
            </label>
            <label>
              Linked account
              <Dropdown
                name="employee-linked-account"
                label="Linked account"
                value={values.linkedUserId}
                onChange={(linkedUserId) => update("linkedUserId", linkedUserId)}
                options={[
                  { value: "", label: "No account" },
                  ...members.map((member) => ({
                    value: member.user.id,
                    label: member.user.fullName,
                    detail: member.user.email,
                  })),
                ]}
              />
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
    </FormModal>
  );
}
