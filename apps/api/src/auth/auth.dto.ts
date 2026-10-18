import { IsOrganizationLogo } from "./organization-logo.dto.js";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsUrl,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ROLES, type Role } from "@puffinpal/permissions";

const normalize = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;
export class LoginDto {
  @ApiProperty({ example: "my-company" })
  @Transform(normalize)
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  organizationSlug!: string;

  @ApiProperty({ example: "owner@example.com" })
  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
export class SignupDto extends LoginDto {
  @ApiProperty({
    required: false,
    enum: ["USD", "EUR", "GBP", "NPR", "INR", "AUD", "CAD", "JPY", "CNY", "CHF", "SGD", "AED"],
  })
  @IsOptional()
  @IsIn(["USD", "EUR", "GBP", "NPR", "INR", "AUD", "CAD", "JPY", "CNY", "CHF", "SGD", "AED"])
  currency?: string;

  @ApiProperty({
    required: false,
    description: "Optional company logo image data URL",
  })
  @IsOptional()
  @IsOrganizationLogo()
  logoUrl?: string;

  @ApiProperty({ example: "My Company" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  organizationName!: string;

  @ApiProperty({ example: "Nirjal" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  fullName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(/\S/)
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  middleName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(/\S/)
  lastName?: string;

  @ApiProperty({ required: false, example: "+12025550123" })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiProperty({ required: false, example: "https://example.com" })
  @IsOptional()
  @MaxLength(2048)
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  companyWebsite?: string;

  @ApiProperty({
    required: false,
    enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"],
  })
  @IsOptional()
  @IsIn(["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"])
  employeeCount?: string;

  @ApiProperty({ required: false, writeOnly: true })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  confirmPassword?: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @MinLength(12)
  declare password: string;
}
export class CreateMemberDto {
  @ApiProperty({ example: "colleague@example.com" })
  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  fullName!: string;
  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
  @ApiProperty({ enum: ROLES.filter((role) => role !== "OWNER") })
  @IsIn(ROLES.filter((role) => role !== "OWNER"))
  role!: Role;
}

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  fullName!: string;
}
export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
