import { DatePicker } from "@/components/ui/date-picker";
import type {
  Department,
  Employee,
  EmployeeFormValues,
  MemberSummary,
  SalaryFormValues,
  SalaryStructure,
} from "../types/employee.types";
import { EmployeeFormModal } from "../dialogs/employee-form-modal";
import { ConfirmationModal } from "../dialogs/confirmation-modal";
import { DepartmentModal } from "../dialogs/department-modal";
import { EmployeeDetailsModal } from "../dialogs/employee-details-modal";
import { SalaryFormModal } from "../dialogs/salary-form-modal";

export function EmployeePageDialogs(props: {
  currency: string;
  employees: Employee[];
  departments: Department[];
  members: MemberSummary[];
  editingEmployee: Employee | "new" | null;
  employeeForm: EmployeeFormValues;
  selectedEmployee: Employee | null;
  salaryStructures: SalaryStructure[];
  salaryForm: SalaryFormValues;
  isSalaryFormOpen: boolean;
  isDepartmentModalOpen: boolean;
  isTerminationOpen: boolean;
  terminationDate: string;
  departmentToDelete: Department | null;
  isSaving: boolean;
  canManageEmployees: boolean;
  canReadSalary: boolean;
  canManageSalary: boolean;
  onEmployeeFormChange: (value: EmployeeFormValues) => void;
  onEmployeeSubmit: () => void;
  onCloseEmployeeForm: () => void;
  onCloseEmployeeDetails: () => void;
  onOpenTermination: () => void;
  onOpenSalary: () => void;
  onSalaryFormChange: (value: SalaryFormValues) => void;
  onSalarySubmit: () => void;
  onCloseSalary: () => void;
  onDepartmentSave: (name: string, department?: Department) => void;
  onDepartmentDelete: (department: Department) => void;
  onCloseDepartments: () => void;
  onTerminationDateChange: (value: string) => void;
  onTerminationConfirm: () => void;
  onCloseTermination: () => void;
  onDepartmentDeleteConfirm: () => void;
  onCloseDepartmentDelete: () => void;
}) {
  const {
    currency,
    employees,
    departments,
    members,
    editingEmployee,
    employeeForm,
    selectedEmployee,
    salaryStructures,
    salaryForm,
    isSalaryFormOpen,
    isDepartmentModalOpen,
    isTerminationOpen,
    terminationDate,
    departmentToDelete,
    isSaving,
    canManageEmployees,
    canReadSalary,
    canManageSalary,
  } = props;
  return (
    <>
      {editingEmployee && (
        <EmployeeFormModal
          employee={editingEmployee === "new" ? undefined : editingEmployee}
          values={employeeForm}
          employees={employees}
          departments={departments}
          members={members}
          isSaving={isSaving}
          onChange={props.onEmployeeFormChange}
          onSubmit={props.onEmployeeSubmit}
          onClose={props.onCloseEmployeeForm}
        />
      )}
      {selectedEmployee && !isTerminationOpen && !isSalaryFormOpen && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          salaryStructures={salaryStructures}
          currency={currency}
          canManage={canManageEmployees}
          canReadSalary={canReadSalary}
          canManageSalary={canManageSalary}
          onTerminate={props.onOpenTermination}
          onAddSalary={props.onOpenSalary}
          onClose={props.onCloseEmployeeDetails}
        />
      )}
      {isSalaryFormOpen && (
        <SalaryFormModal
          values={salaryForm}
          currency={currency}
          isSaving={isSaving}
          onChange={props.onSalaryFormChange}
          onSubmit={props.onSalarySubmit}
          onClose={props.onCloseSalary}
        />
      )}
      {isDepartmentModalOpen && (
        <DepartmentModal
          departments={departments}
          isSaving={isSaving}
          onSave={props.onDepartmentSave}
          onDelete={props.onDepartmentDelete}
          onClose={props.onCloseDepartments}
        />
      )}
      {isTerminationOpen && selectedEmployee && (
        <ConfirmationModal
          title="Terminate employment"
          message={`End employment for ${selectedEmployee.firstName} ${selectedEmployee.lastName}? Their history will be retained.`}
          confirmLabel="Terminate employee"
          danger
          isSaving={isSaving}
          onConfirm={props.onTerminationConfirm}
          onClose={props.onCloseTermination}
        >
          <label>
            Termination date
            <DatePicker
              min={selectedEmployee.hireDate.slice(0, 10)}
              value={terminationDate}
              onChange={props.onTerminationDateChange}
              ariaLabel="Employment termination date"
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
          onConfirm={props.onDepartmentDeleteConfirm}
          onClose={props.onCloseDepartmentDelete}
        />
      )}
    </>
  );
}
