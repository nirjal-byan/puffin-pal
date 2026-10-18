import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type {
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateSalaryStructureDto,
  EmployeeQueryDto,
  TerminateEmployeeDto,
  UpdateDepartmentDto,
  UpdateEmployeeDto,
} from "./employee.dto.js";
import { assertManagerChain, rangesOverlap } from "./employee-rules.js";
import { expenseAmount } from "../expenses/expense-money.js";

@Injectable({ scope: Scope.REQUEST })
export class EmployeesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}
  private get tenant() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth;
  }
  private get organizationId() {
    return this.tenant.organizationId;
  }
  private date(value: string) {
    try {
      return Temporal.Instant.from(`${value}T00:00:00Z`);
    } catch {
      throw new BadRequestException("Provide a valid date");
    }
  }
  private day(value: { toString(): string }) {
    return value.toString().slice(0, 10);
  }
  private async find(id: string) {
    const employee = await this.db.orm.public.Employee.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!employee) throw new NotFoundException("Employee not found");
    return employee;
  }
  private async references(employee: Awaited<ReturnType<EmployeesService["find"]>>) {
    const [department, manager, linkedUser] = await Promise.all([
      employee.departmentId
        ? this.db.orm.public.Department.where({
            organizationId: this.organizationId,
            id: employee.departmentId,
          })
            .select("id", "name")
            .first()
        : null,
      employee.managerId
        ? this.db.orm.public.Employee.where({
            organizationId: this.organizationId,
            id: employee.managerId,
          })
            .select("id", "firstName", "lastName")
            .first()
        : null,
      employee.linkedUserId
        ? this.db.orm.public.User.where({
            organizationId: this.organizationId,
            id: employee.linkedUserId,
          })
            .select("id", "fullName", "email")
            .first()
        : null,
    ]);
    return { ...employee, department, manager, linkedUser };
  }
  async list(query: EmployeeQueryDto) {
    let rows = await this.db.orm.public.Employee.where({
      organizationId: this.organizationId,
    }).all();
    const search = query.search?.trim().toLowerCase();
    if (search)
      rows = rows.filter((row) =>
        [row.employeeCode, row.firstName, row.lastName, row.workEmail, row.jobTitle].some((value) =>
          value?.toLowerCase().includes(search),
        ),
      );
    if (query.status) rows = rows.filter((row) => row.status === query.status);
    if (query.employmentType)
      rows = rows.filter((row) => row.employmentType === query.employmentType);
    if (query.departmentId) rows = rows.filter((row) => row.departmentId === query.departmentId);
    rows.sort((a, b) =>
      query.sort === "employeeCode"
        ? a.employeeCode.localeCompare(b.employeeCode)
        : query.sort === "hireDate"
          ? this.day(b.hireDate).localeCompare(this.day(a.hireDate))
          : `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    );
    const total = rows.length;
    return {
      items: await Promise.all(
        rows.slice(query.offset, query.offset + query.limit).map((row) => this.references(row)),
      ),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async get(id: string) {
    const employee = await this.find(id);
    const auditEvents = await this.db.orm.public.EmployeeAuditEvent.where({
      organizationId: this.organizationId,
      employeeId: id,
    })
      .orderBy((row) => row.createdAt.desc())
      .limit(30)
      .all();
    return { ...(await this.references(employee)), auditEvents };
  }
  private async validateReferences(
    employeeId: string | null,
    departmentId?: string,
    managerId?: string,
    linkedUserId?: string,
  ) {
    if (
      departmentId &&
      !(await this.db.orm.public.Department.where({
        organizationId: this.organizationId,
        id: departmentId,
      }).first())
    )
      throw new BadRequestException("Department not found");
    if (managerId) {
      if (
        !(await this.db.orm.public.Employee.where({
          organizationId: this.organizationId,
          id: managerId,
        }).first())
      )
        throw new BadRequestException("Manager not found");
      const employees = await this.db.orm.public.Employee.where({
        organizationId: this.organizationId,
      })
        .select("id", "managerId")
        .all();
      try {
        assertManagerChain(
          employeeId ?? "__new__",
          managerId,
          new Map(employees.map((row) => [row.id, row.managerId])),
        );
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    }
    if (
      linkedUserId &&
      !(await this.db.orm.public.User.where({
        organizationId: this.organizationId,
        id: linkedUserId,
      }).first())
    )
      throw new BadRequestException("Linked user not found");
  }
  async create(input: CreateEmployeeDto) {
    await this.validateReferences(null, input.departmentId, input.managerId, input.linkedUserId);
    try {
      const employee = await this.db.orm.public.Employee.create({
        organizationId: this.organizationId,
        employeeCode: input.employeeCode.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        workEmail: input.workEmail?.trim().toLowerCase() || null,
        phoneNumber: input.phoneNumber?.trim() || null,
        notes: input.notes?.trim() || null,
        jobTitle: input.jobTitle.trim(),
        employmentType: input.employmentType,
        status: input.status ?? "ACTIVE",
        hireDate: this.date(input.hireDate),
        departmentId: input.departmentId ?? null,
        managerId: input.managerId ?? null,
        linkedUserId: input.linkedUserId ?? null,
      });
      await this.db.orm.public.EmployeeAuditEvent.create({
        organizationId: this.organizationId,
        employeeId: employee.id,
        actorId: this.tenant.userId,
        action: "CREATED",
        details: JSON.stringify({ employeeCode: employee.employeeCode }),
      });
      return this.references(employee);
    } catch (error) {
      if (String(error).includes("unique"))
        throw new ConflictException("Employee code or linked user is already in use");
      throw error;
    }
  }
  async update(id: string, input: UpdateEmployeeDto) {
    const employee = await this.find(id);
    if (employee.status === "TERMINATED")
      throw new ConflictException("Terminated employees cannot be edited");
    await this.validateReferences(id, input.departmentId, input.managerId, input.linkedUserId);
    const { expectedVersion } = input;
    const [updated] = await this.db.orm.public.Employee.where({
      organizationId: this.organizationId,
      id,
      version: expectedVersion,
    }).updateAll({
      ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode.trim() } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(input.workEmail !== undefined
        ? { workEmail: input.workEmail.trim().toLowerCase() || null }
        : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle.trim() } : {}),
      ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.hireDate !== undefined ? { hireDate: this.date(input.hireDate) } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId || null } : {}),
      ...(input.linkedUserId !== undefined ? { linkedUserId: input.linkedUserId || null } : {}),
      version: expectedVersion + 1,
    });
    if (!updated) throw new ConflictException("Employee changed. Reload and try again.");
    await this.db.orm.public.EmployeeAuditEvent.create({
      organizationId: this.organizationId,
      employeeId: id,
      actorId: this.tenant.userId,
      action: employee.status === updated.status ? "UPDATED" : "STATUS_CHANGED",
      details: JSON.stringify({ version: updated.version }),
    });
    return this.references(updated);
  }
  async terminate(id: string, input: TerminateEmployeeDto) {
    const employee = await this.find(id);
    const terminationDate = this.date(input.terminationDate);
    if (employee.status === "TERMINATED")
      throw new ConflictException("Employee is already terminated");
    if (input.terminationDate < this.day(employee.hireDate))
      throw new BadRequestException("Termination date cannot be before hire date");
    const [updated] = await this.db.orm.public.Employee.where({
      organizationId: this.organizationId,
      id,
      version: input.expectedVersion,
    }).updateAll({ status: "TERMINATED", terminationDate, version: input.expectedVersion + 1 });
    if (!updated) throw new ConflictException("Employee changed. Reload and try again.");
    await this.db.orm.public.EmployeeAuditEvent.create({
      organizationId: this.organizationId,
      employeeId: id,
      actorId: this.tenant.userId,
      action: "TERMINATED",
      details: JSON.stringify({ terminationDate: input.terminationDate }),
    });
    return this.references(updated);
  }
  async salaryHistory(id: string) {
    await this.find(id);
    const salaries = await this.db.orm.public.SalaryStructure.where({
      organizationId: this.organizationId,
      employeeId: id,
    })
      .orderBy((row) => row.effectiveFrom.desc())
      .all();
    return Promise.all(
      salaries.map(async (salary) => ({
        ...salary,
        components: await this.db.orm.public.SalaryComponent.where({
          organizationId: this.organizationId,
          salaryStructureId: salary.id,
        }).all(),
      })),
    );
  }
  async createSalary(id: string, input: CreateSalaryStructureDto) {
    await this.find(id);
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom)
      throw new BadRequestException("Effective end must be on or after the start date");
    return this.db.transaction(async (tx) => {
      await tx.execute(
        this.db.raw
          .sql`SELECT id FROM employees WHERE id = ${id} AND "organizationId" = ${this.organizationId} FOR UPDATE`
          .affectedCount()
          .build(),
      );
      const existing = await tx.orm.public.SalaryStructure.where({
        organizationId: this.organizationId,
        employeeId: id,
      }).all();
      const overlapping = existing.filter((row) =>
        rangesOverlap(
          input.effectiveFrom,
          input.effectiveTo ?? null,
          this.day(row.effectiveFrom),
          row.effectiveTo ? this.day(row.effectiveTo) : null,
        ),
      );
      const current =
        overlapping.length === 1 &&
        !overlapping[0]!.effectiveTo &&
        this.day(overlapping[0]!.effectiveFrom) < input.effectiveFrom
          ? overlapping[0]!
          : null;
      if (overlapping.length && !current)
        throw new ConflictException("This effective date range overlaps existing salary history");
      if (current) {
        if (input.expectedCurrentVersion !== current.version)
          throw new ConflictException("Current salary changed. Reload and try again.");
        const priorEnd = Temporal.PlainDate.from(input.effectiveFrom)
          .subtract({ days: 1 })
          .toString();
        const [closed] = await tx.orm.public.SalaryStructure.where({
          organizationId: this.organizationId,
          id: current.id,
          version: current.version,
        }).updateAll({ effectiveTo: this.date(priorEnd), version: current.version + 1 });
        if (!closed) throw new ConflictException("Current salary changed. Reload and try again.");
      }
      const salary = await tx.orm.public.SalaryStructure.create({
        organizationId: this.organizationId,
        employeeId: id,
        compensationType: input.compensationType,
        baseAmount: expenseAmount(input.baseAmount),
        currency: input.currency,
        payFrequency: input.payFrequency,
        effectiveFrom: this.date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? this.date(input.effectiveTo) : null,
        notes: input.notes?.trim() || null,
        createdById: this.tenant.userId,
      });
      for (const [index, component] of input.components.entries())
        await tx.orm.public.SalaryComponent.create({
          organizationId: this.organizationId,
          salaryStructureId: salary.id,
          name: component.name.trim(),
          type: component.type,
          amount: expenseAmount(component.amount),
          sortOrder: component.sortOrder ?? index,
        });
      const action = current
        ? "SALARY_REVISED"
        : input.effectiveFrom > Temporal.Now.plainDateISO("UTC").toString()
          ? "SALARY_SCHEDULED"
          : "SALARY_CREATED";
      await tx.orm.public.EmployeeAuditEvent.create({
        organizationId: this.organizationId,
        employeeId: id,
        actorId: this.tenant.userId,
        action,
        details: JSON.stringify({
          salaryStructureId: salary.id,
          effectiveFrom: input.effectiveFrom,
        }),
      });
      return salary;
    });
  }
  departments() {
    return this.db.orm.public.Department.where({ organizationId: this.organizationId })
      .orderBy((row) => row.name.asc())
      .all();
  }
  async createDepartment(input: CreateDepartmentDto) {
    try {
      return await this.db.orm.public.Department.create({
        organizationId: this.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
      });
    } catch (error) {
      if (String(error).includes("unique"))
        throw new ConflictException("Department name already exists");
      throw error;
    }
  }
  async updateDepartment(id: string, input: UpdateDepartmentDto) {
    const department = await this.db.orm.public.Department.where({
      organizationId: this.organizationId,
      id,
    }).update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
    });
    if (!department) throw new NotFoundException("Department not found");
    return department;
  }
  async removeDepartment(id: string) {
    const department = await this.db.orm.public.Department.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!department) throw new NotFoundException("Department not found");
    if (
      await this.db.orm.public.Employee.where({
        organizationId: this.organizationId,
        departmentId: id,
      }).first()
    )
      throw new ConflictException("Move employees out of this department before deleting it");
    await this.db.orm.public.Department.where({ organizationId: this.organizationId, id }).delete();
    return { message: "Department deleted successfully." };
  }
}
