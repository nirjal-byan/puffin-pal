#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7a1e6ca649486c12b389e9af279fa96a420349ed903953cea971434206c7ace6/contract';
import endContract from '../../snapshots/7a1e6ca649486c12b389e9af279fa96a420349ed903953cea971434206c7ace6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dfb9f0d1f85b9778eec823be2a74f373e3359cfbe6c8562591a52c5c75b8ffb1/contract';
import startContract from '../../snapshots/dfb9f0d1f85b9778eec823be2a74f373e3359cfbe6c8562591a52c5c75b8ffb1/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'attendance_records',
        columns: [
          col('checkInAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('checkOutAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isLate', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', {
            notNull: true,
            default: lit('MANUAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('updatedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('workDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('workedMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'attendance_records_source_check_4aa26323',
            "\"source\" IN ('MANUAL', 'SELF_SERVICE')",
          ),
          checkExpression(
            'attendance_records_status_check_23c88bfa',
            "\"status\" IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'holidays',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('date', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isRecurring', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'leave_ledger_entries',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaveRequestId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('leaveTypeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('units', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'leave_ledger_entries_kind_check_1749ad13',
            "\"kind\" IN ('ALLOCATION', 'DEDUCTION', 'RESTORATION', 'ADJUSTMENT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'leave_requests',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('dayPortion', 'text', {
            notNull: true,
            default: lit('FULL_DAY'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('endDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaveTypeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('requestedUnits', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('reviewedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('submittedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'leave_requests_dayPortion_check_bfc779d0',
            "\"dayPortion\" IN ('FULL_DAY', 'HALF_DAY')",
          ),
          checkExpression(
            'leave_requests_status_check_b2e51141',
            "\"status\" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'leave_types',
        columns: [
          col('annualAllowanceUnits', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isPaid', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requiresApproval', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'overtime_requests',
        columns: [
          col('approvedMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('approvedRateSnapshot', 'numeric(14,4)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 4 } },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hourlyRate', 'numeric(14,4)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 4 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('multiplier', 'numeric(8,4)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 8, scale: 4 } },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('requestedMinutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('reviewedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('workDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'overtime_requests_status_check_b2e51141',
            "\"status\" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'work_schedules',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('effectiveFrom', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('effectiveTo', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expectedDailyMinutes', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scheduledEndTime', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scheduledStartTime', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timezone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('workdays', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'workforce_audit_events',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('rateSnapshot', 'numeric(14,4)', {
          codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 4 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('sourceMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('sourceOvertimeRequestId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'attendance_records',
        constraint: 'attendance_records_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'attendance_records',
        constraint: 'attendance_records_organizationId_employeeId_workDate_key',
        columns: ['organizationId', 'employeeId', 'workDate'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'holidays',
        constraint: 'holidays_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'holidays',
        constraint: 'holidays_organizationId_date_name_key',
        columns: ['organizationId', 'date', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'leave_ledger_entries',
        constraint: 'leave_ledger_request_kind_key',
        columns: ['organizationId', 'leaveRequestId', 'kind'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'leave_requests',
        constraint: 'leave_requests_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'leave_types',
        constraint: 'leave_types_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'leave_types',
        constraint: 'leave_types_organizationId_code_key',
        columns: ['organizationId', 'code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'overtime_requests',
        constraint: 'overtime_requests_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_entry_components',
        constraint: 'payroll_component_overtime_key',
        columns: ['organizationId', 'sourceOvertimeRequestId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'work_schedules',
        constraint: 'work_schedules_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_records',
        index: 'attendance_records_organizationId_createdById_idx_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_records',
        index: 'attendance_records_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_records',
        index: 'attendance_records_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_records',
        index: 'attendance_records_organizationId_updatedById_idx_70649bae',
        columns: ['organizationId', 'updatedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_records',
        index: 'attendance_records_organizationId_workDate_status_idx_be7b5622',
        columns: ['organizationId', 'workDate', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'holidays',
        index: 'holidays_organizationId_date_idx_eac2a339',
        columns: ['organizationId', 'date'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'holidays',
        index: 'holidays_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_ledger_entries',
        index: 'leave_ledger_employee_type_idx',
        columns: ['organizationId', 'employeeId', 'leaveTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_ledger_entries',
        index: 'leave_ledger_entries_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_ledger_entries',
        index: 'leave_ledger_entries_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_ledger_entries',
        index: 'leave_ledger_entries_organizationId_leaveRequestId_idx_333305ec',
        columns: ['organizationId', 'leaveRequestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_ledger_entries',
        index: 'leave_ledger_entries_organizationId_leaveTypeId_idx_bffb852c',
        columns: ['organizationId', 'leaveTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_requests',
        index: 'leave_request_employee_dates_idx',
        columns: ['organizationId', 'employeeId', 'startDate', 'endDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_requests',
        index: 'leave_requests_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_requests',
        index: 'leave_requests_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_requests',
        index: 'leave_requests_organizationId_leaveTypeId_idx_bffb852c',
        columns: ['organizationId', 'leaveTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_requests',
        index: 'leave_requests_organizationId_reviewedById_idx_82814071',
        columns: ['organizationId', 'reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_requests',
        index: 'leave_requests_organizationId_status_idx_21af5e82',
        columns: ['organizationId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_types',
        index: 'leave_types_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'overtime_requests',
        index: 'overtime_employee_date_idx',
        columns: ['organizationId', 'employeeId', 'workDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'overtime_requests',
        index: 'overtime_requests_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'overtime_requests',
        index: 'overtime_requests_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'overtime_requests',
        index: 'overtime_requests_organizationId_reviewedById_idx_82814071',
        columns: ['organizationId', 'reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'overtime_requests',
        index: 'overtime_status_idx',
        columns: ['organizationId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'work_schedules',
        index: 'work_schedule_effective_idx',
        columns: ['organizationId', 'employeeId', 'effectiveFrom'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'work_schedules',
        index: 'work_schedules_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'work_schedules',
        index: 'work_schedules_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workforce_audit_events',
        index: 'workforce_audit_employee_idx',
        columns: ['organizationId', 'employeeId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workforce_audit_events',
        index: 'workforce_audit_entity_idx',
        columns: ['organizationId', 'entityType', 'entityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workforce_audit_events',
        index: 'workforce_audit_events_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workforce_audit_events',
        index: 'workforce_audit_events_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workforce_audit_events',
        index: 'workforce_audit_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_records',
        foreignKey: {
          name: 'attendance_records_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_records',
        foreignKey: {
          name: 'attendance_records_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_records',
        foreignKey: {
          name: 'attendance_records_organizationId_createdById_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_records',
        foreignKey: {
          name: 'attendance_records_organizationId_updatedById_fkey',
          columns: ['organizationId', 'updatedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'holidays',
        foreignKey: {
          name: 'holidays_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_ledger_entries',
        foreignKey: {
          name: 'leave_ledger_entries_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_ledger_entries',
        foreignKey: {
          name: 'leave_ledger_entries_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_ledger_entries',
        foreignKey: {
          name: 'leave_ledger_entries_organizationId_leaveTypeId_fkey',
          columns: ['organizationId', 'leaveTypeId'],
          references: { schema: 'public', table: 'leave_types', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_ledger_entries',
        foreignKey: {
          name: 'leave_ledger_entries_organizationId_leaveRequestId_fkey',
          columns: ['organizationId', 'leaveRequestId'],
          references: {
            schema: 'public',
            table: 'leave_requests',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_requests',
        foreignKey: {
          name: 'leave_requests_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_requests',
        foreignKey: {
          name: 'leave_requests_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_requests',
        foreignKey: {
          name: 'leave_requests_organizationId_leaveTypeId_fkey',
          columns: ['organizationId', 'leaveTypeId'],
          references: { schema: 'public', table: 'leave_types', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_requests',
        foreignKey: {
          name: 'leave_requests_organizationId_reviewedById_fkey',
          columns: ['organizationId', 'reviewedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_types',
        foreignKey: {
          name: 'leave_types_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'overtime_requests',
        foreignKey: {
          name: 'overtime_requests_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'overtime_requests',
        foreignKey: {
          name: 'overtime_requests_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'overtime_requests',
        foreignKey: {
          name: 'overtime_requests_organizationId_reviewedById_fkey',
          columns: ['organizationId', 'reviewedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_entry_components',
        foreignKey: {
          name: 'payroll_component_overtime_fkey',
          columns: ['organizationId', 'sourceOvertimeRequestId'],
          references: {
            schema: 'public',
            table: 'overtime_requests',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'work_schedules',
        foreignKey: {
          name: 'work_schedules_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'work_schedules',
        foreignKey: {
          name: 'work_schedules_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workforce_audit_events',
        foreignKey: {
          name: 'workforce_audit_events_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workforce_audit_events',
        foreignKey: {
          name: 'workforce_audit_events_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workforce_audit_events',
        foreignKey: {
          name: 'workforce_audit_events_organizationId_actorId_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
