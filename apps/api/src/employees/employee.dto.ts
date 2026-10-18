import { PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;
export const EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export class CreateEmployeeDto {
  @IsString() @Matches(/\S/) @MaxLength(40) employeeCode!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) firstName!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) lastName!: string;
  @IsOptional() @IsEmail() @MaxLength(254) workEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) phoneNumber?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsString() @Matches(/\S/) @MaxLength(120) jobTitle!: string;
  @IsIn(EMPLOYMENT_TYPES) employmentType!: (typeof EMPLOYMENT_TYPES)[number];
  @IsOptional() @IsIn(EMPLOYMENT_STATUSES.filter((value) => value !== "TERMINATED")) status?:
    "ACTIVE" | "ON_LEAVE" | "INACTIVE";
  @Matches(DATE) hireDate!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() managerId?: string;
  @IsOptional() @IsUUID() linkedUserId?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto, {
  skipNullProperties: false,
}) {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class TerminateEmployeeDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @Matches(DATE) terminationDate!: string;
}

export class EmployeeQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(EMPLOYMENT_STATUSES) status?: (typeof EMPLOYMENT_STATUSES)[number];
  @IsOptional() @IsIn(EMPLOYMENT_TYPES) employmentType?: (typeof EMPLOYMENT_TYPES)[number];
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsIn(["name", "employeeCode", "hireDate"]) sort:
    "name" | "employeeCode" | "hireDate" = "name";
}

export class CreateDepartmentDto {
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto, {
  skipNullProperties: false,
}) {}

export class SalaryComponentDto {
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
  @IsIn(["EARNING", "DEDUCTION"]) type!: "EARNING" | "DEDUCTION";
  @Matches(MONEY) amount!: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
}

export class CreateSalaryStructureDto {
  @IsIn(["FIXED_SALARY", "HOURLY"]) compensationType!: "FIXED_SALARY" | "HOURLY";
  @Matches(MONEY) baseAmount!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsIn(["MONTHLY", "BIWEEKLY", "WEEKLY"]) payFrequency!: "MONTHLY" | "BIWEEKLY" | "WEEKLY";
  @Matches(DATE) effectiveFrom!: string;
  @IsOptional() @Matches(DATE) effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsInt() @Min(1) expectedCurrentVersion?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components: SalaryComponentDto[] = [];
}
