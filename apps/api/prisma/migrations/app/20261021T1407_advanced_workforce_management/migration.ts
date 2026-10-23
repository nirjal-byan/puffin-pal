#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ba782965fb6c1a29e2ff42ecf9c4201008d69c6ee270373ac6e14a39c6d665dd/contract';
import endContract from '../../snapshots/ba782965fb6c1a29e2ff42ecf9c4201008d69c6ee270373ac6e14a39c6d665dd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bc9d0b30b214355decab0d622e6d088a928e6f2db82aabc41803ccfd87498d2c/contract';
import startContract from '../../snapshots/bc9d0b30b214355decab0d622e6d088a928e6f2db82aabc41803ccfd87498d2c/contract.json' with { type: 'json' };
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
      this.dropCheckConstraint({
        schema: 'public',
        table: 'leave_ledger_entries',
        constraint: 'leave_ledger_entries_kind_check_1749ad13',
      }),
      this.createTable({
        schema: 'public',
        table: 'attendance_correction_requests',
        columns: [
          col('attendanceRecordId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('beforeSnapshot', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollImpact', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('proposedCheckInAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('proposedCheckOutAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('proposedStatus', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('proposedWorkedMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reviewReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('reviewedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
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
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'attendance_correction_requests_proposedStatus_check_fe4a56e7',
            "\"proposedStatus\" IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY')",
          ),
          checkExpression(
            'attendance_correction_requests_status_check_57fe5f48',
            "\"status\" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'leave_accrual_policies',
        columns: [
          col('carryForwardCapMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('carryForwardMode', 'text', {
            notNull: true,
            default: lit('NONE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
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
          col('entitlementMinutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('expiresAfterMonths', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('frequency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('leaveTypeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('maximumBalanceMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('prorateNewJoiners', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
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
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'leave_accrual_policies_carryForwardMode_check_bd1fde0a',
            "\"carryForwardMode\" IN ('NONE', 'FULL', 'CAPPED')",
          ),
          checkExpression(
            'leave_accrual_policies_frequency_check_a515430c',
            "\"frequency\" IN ('ANNUAL', 'MONTHLY', 'SERVICE_MONTHLY')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'holidays',
        column: col('durationMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'holidays',
        column: col('version', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'leave_ledger_entries',
        column: col('effectiveDate', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'leave_ledger_entries',
        column: col('expiresAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'leave_ledger_entries',
        column: col('idempotencyKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'leave_ledger_entries',
        column: col('minutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'leave_ledger_entries',
        column: col('policyId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'leave_requests',
        column: col('requestedMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'organizations',
        column: col('timezone', 'text', {
          notNull: true,
          default: lit('UTC'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'organizations',
        column: col('unpaidLeaveDeductionsEnabled', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('sourceLeaveRequestId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'work_schedules',
        column: col('breakMinutes', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'work_schedules',
        column: col('isActive', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'work_schedules',
        column: col('name', 'text', {
          notNull: true,
          default: lit('Standard schedule'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'work_schedules',
        column: col('version', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.dropNotNull({ schema: 'public', table: 'workforce_audit_events', column: 'employeeId' }),
      this.addUnique({
        schema: 'public',
        table: 'attendance_correction_requests',
        constraint: 'attendance_correction_requests_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'leave_accrual_policies',
        constraint: 'leave_accrual_policies_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'leave_accrual_policies',
        constraint: 'leave_policy_type_name_key',
        columns: ['organizationId', 'leaveTypeId', 'name'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'leave_ledger_entries',
        constraint: 'leave_ledger_entries_kind_check_9b0ff313',
        expression:
          "\"kind\" IN ('ALLOCATION', 'ACCRUAL', 'CARRY_FORWARD', 'EXPIRATION', 'DEDUCTION', 'RESTORATION', 'ADJUSTMENT')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'leave_ledger_entries',
        constraint: 'leave_ledger_idempotency_key',
        columns: ['organizationId', 'idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_entry_components',
        constraint: 'payroll_component_leave_key',
        columns: ['organizationId', 'sourceLeaveRequestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_correction_requests',
        index: 'attendance_correction_employee_idx',
        columns: ['organizationId', 'employeeId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_correction_requests',
        index: 'attendance_correction_record_idx',
        columns: ['organizationId', 'attendanceRecordId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_correction_requests',
        index: 'attendance_correction_requests_organizationId_attendan_e3e17a38',
        columns: ['organizationId', 'attendanceRecordId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_correction_requests',
        index: 'attendance_correction_requests_organizationId_employee_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_correction_requests',
        index: 'attendance_correction_requests_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_correction_requests',
        index: 'attendance_correction_requests_organizationId_requeste_5a2c1783',
        columns: ['organizationId', 'requestedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attendance_correction_requests',
        index: 'attendance_correction_requests_organizationId_reviewed_82814071',
        columns: ['organizationId', 'reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_accrual_policies',
        index: 'leave_accrual_policies_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_accrual_policies',
        index: 'leave_accrual_policies_organizationId_leaveTypeId_idx_bffb852c',
        columns: ['organizationId', 'leaveTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_accrual_policies',
        index: 'leave_policy_effective_idx',
        columns: ['organizationId', 'isActive', 'effectiveFrom'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_ledger_entries',
        index: 'leave_ledger_effective_idx',
        columns: ['organizationId', 'effectiveDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'leave_ledger_entries',
        index: 'leave_ledger_entries_organizationId_policyId_idx_977575fb',
        columns: ['organizationId', 'policyId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_correction_requests',
        foreignKey: {
          name: 'attendance_correction_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_correction_requests',
        foreignKey: {
          name: 'attendance_correction_record_fkey',
          columns: ['organizationId', 'attendanceRecordId'],
          references: {
            schema: 'public',
            table: 'attendance_records',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_correction_requests',
        foreignKey: {
          name: 'attendance_correction_employee_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_correction_requests',
        foreignKey: {
          name: 'attendance_correction_requester_fkey',
          columns: ['organizationId', 'requestedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attendance_correction_requests',
        foreignKey: {
          name: 'attendance_correction_reviewer_fkey',
          columns: ['organizationId', 'reviewedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_accrual_policies',
        foreignKey: {
          name: 'leave_accrual_policies_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_accrual_policies',
        foreignKey: {
          name: 'leave_accrual_policies_organizationId_leaveTypeId_fkey',
          columns: ['organizationId', 'leaveTypeId'],
          references: { schema: 'public', table: 'leave_types', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'leave_ledger_entries',
        foreignKey: {
          name: 'leave_ledger_entries_organizationId_policyId_fkey',
          columns: ['organizationId', 'policyId'],
          references: {
            schema: 'public',
            table: 'leave_accrual_policies',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_entry_components',
        foreignKey: {
          name: 'payroll_component_leave_fkey',
          columns: ['organizationId', 'sourceLeaveRequestId'],
          references: {
            schema: 'public',
            table: 'leave_requests',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
