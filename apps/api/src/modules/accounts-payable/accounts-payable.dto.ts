import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const optionalTrim = ({ value }: { value: unknown }) => {
  const transformed = trim({ value });
  return transformed === "" ? undefined : transformed;
};

export class VendorDto {
  @Transform(trim) @IsString() @Length(1, 160) name!: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(160) displayName?: string;
  @Transform(optionalTrim) @IsOptional() @IsEmail() email?: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(300) website?: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(500) address?: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(80) country?: string;
  @Transform(trim) @IsString() @Length(3, 3) defaultCurrency!: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(80) taxId?: string;
  @IsInt() @Min(0) @Max(365) paymentTermsDays!: number;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class UpdateVendorDto extends VendorDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class VendorBillItemDto {
  @Transform(trim) @IsString() @Length(1, 500) description!: string;
  @IsString() quantity!: string;
  @IsString() unitPrice!: string;
  @IsOptional() @IsString() taxAmount?: string;
  @IsOptional() @IsString() discountAmount?: string;
}

export class CreateVendorBillDto {
  @IsUUID() vendorId!: string;
  @IsOptional() @IsUUID() expenseId?: string;
  @Transform(trim) @IsString() @Length(1, 80) billNumber!: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(100) vendorReference?: string;
  @IsDateString() issueDate!: string;
  @IsDateString() dueDate!: string;
  @Transform(trim) @IsString() @Length(3, 3) currency!: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VendorBillItemDto)
  items!: VendorBillItemDto[];
}
export class UpdateVendorBillDto extends CreateVendorBillDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class VersionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
export class RejectBillDto extends VersionDto {
  @Transform(trim) @IsString() @Length(1, 500) reason!: string;
}

export enum PayableTargetDto {
  VENDOR_BILL = "VENDOR_BILL",
  EXPENSE = "EXPENSE",
}
export enum PaymentMethodDto {
  BANK_TRANSFER = "BANK_TRANSFER",
  CASH = "CASH",
  CARD = "CARD",
  CHEQUE = "CHEQUE",
  OTHER = "OTHER",
}
export class PayablePaymentInputDto {
  @IsString() amount!: string;
  @IsDateString() paymentDate!: string;
  @IsEnum(PaymentMethodDto) method!: PaymentMethodDto;
  @IsOptional() @IsUUID() bankAccountId?: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @Transform(optionalTrim) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @Transform(trim) @IsString() @Length(8, 120) idempotencyKey!: string;
}
export class RecordPayablePaymentDto extends PayablePaymentInputDto {
  @IsEnum(PayableTargetDto) targetType!: PayableTargetDto;
  @IsUUID() targetId!: string;
}
export class ReversePayablePaymentDto extends VersionDto {
  @Transform(trim) @IsString() @Length(1, 500) reason!: string;
}

export class PayablesQueryDto {
  @IsOptional() @Transform(optionalTrim) @IsString() search?: string;
  @IsOptional() @IsUUID() vendorId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
