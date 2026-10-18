import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import {
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateSalaryStructureDto,
  EmployeeQueryDto,
  TerminateEmployeeDto,
  UpdateDepartmentDto,
  UpdateEmployeeDto,
} from "./employee.dto.js";
import { EmployeesService } from "./employees.service.js";

@ApiTags("employees")
@ApiBearerAuth()
@Controller()
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}
  @Get("employees") @RequirePermissions("employees:read") list(@Query() query: EmployeeQueryDto) {
    return this.employees.list(query);
  }
  @Get("employees/:id") @RequirePermissions("employees:read") get(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.employees.get(id);
  }
  @Post("employees") @RequirePermissions("employees:create") create(
    @Body() input: CreateEmployeeDto,
  ) {
    return this.employees.create(input);
  }
  @Patch("employees/:id") @RequirePermissions("employees:update") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateEmployeeDto,
  ) {
    return this.employees.update(id, input);
  }
  @Post("employees/:id/terminate") @HttpCode(200) @RequirePermissions("employees:manage") terminate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: TerminateEmployeeDto,
  ) {
    return this.employees.terminate(id, input);
  }
  @Get("employees/:id/salary-structures") @RequirePermissions("salaries:read") salaryHistory(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.employees.salaryHistory(id);
  }
  @Post("employees/:id/salary-structures") @RequirePermissions("salaries:manage") createSalary(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CreateSalaryStructureDto,
  ) {
    return this.employees.createSalary(id, input);
  }
  @Get("departments") @RequirePermissions("employees:read") departments() {
    return this.employees.departments();
  }
  @Post("departments") @RequirePermissions("employees:manage") createDepartment(
    @Body() input: CreateDepartmentDto,
  ) {
    return this.employees.createDepartment(input);
  }
  @Patch("departments/:id") @RequirePermissions("employees:manage") updateDepartment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateDepartmentDto,
  ) {
    return this.employees.updateDepartment(id, input);
  }
  @Delete("departments/:id") @RequirePermissions("employees:manage") removeDepartment(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.employees.removeDepartment(id);
  }
}
