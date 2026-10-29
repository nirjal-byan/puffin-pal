import { AppModal } from "@/components/ui/app-modal";
import type { Employee, SalaryStructure } from "../types/employee.types";

export function EmployeeDetailsModal({
  employee,
  salaryStructures,
  currency,
  canManage,
  canReadSalary,
  canManageSalary,
  onTerminate,
  onAddSalary,
  onClose,
}: {
  employee: Employee;
  salaryStructures: SalaryStructure[];
  currency: string;
  canManage: boolean;
  canReadSalary: boolean;
  canManageSalary: boolean;
  onTerminate: () => void;
  onAddSalary: () => void;
  onClose: () => void;
}) {
  const money = (salary: SalaryStructure) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: salary.currency || currency,
    }).format(Number(salary.baseAmount));
  return (
    <AppModal
      title={`${employee.firstName} ${employee.lastName}`}
      badge={employee.status.replaceAll("_", " ")}
      onClose={onClose}
    >
      <div className="employee-profile">
        <dl>
          <div>
            <dt>Employee code</dt>
            <dd>{employee.employeeCode}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{employee.jobTitle}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{employee.department?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Hire date</dt>
            <dd>{new Date(employee.hireDate).toLocaleDateString()}</dd>
          </div>
        </dl>
        {canManage && employee.status !== "TERMINATED" && (
          <button className="button danger" onClick={onTerminate}>
            Terminate employment
          </button>
        )}
        {canReadSalary && (
          <section className="salary-history">
            <div className="panel-heading">
              <h3>Salary history</h3>
              {canManageSalary && (
                <button className="button secondary compact" onClick={onAddSalary}>
                  + Salary
                </button>
              )}
            </div>
            {salaryStructures.length === 0 ? (
              <p className="muted">No salary structures recorded.</p>
            ) : (
              salaryStructures.map((salary) => (
                <article key={salary.id}>
                  <strong>{money(salary)}</strong>
                  <span>
                    {salary.compensationType.replaceAll("_", " ")} ·{" "}
                    {salary.payFrequency.toLowerCase()}
                  </span>
                  <small>
                    {new Date(salary.effectiveFrom).toLocaleDateString()} –{" "}
                    {salary.effectiveTo
                      ? new Date(salary.effectiveTo).toLocaleDateString()
                      : "Current"}
                  </small>
                  {salary.components.length > 0 && (
                    <small>
                      {salary.components
                        .map((component) => `${component.name}: ${component.amount}`)
                        .join(" · ")}
                    </small>
                  )}
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </AppModal>
  );
}
