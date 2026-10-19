#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/205b388ad73b6fc2fe5b0bc4eebb8e89bdbaeec2c0051929272b22ec0ce6881c/contract';
import endContract from '../../snapshots/205b388ad73b6fc2fe5b0bc4eebb8e89bdbaeec2c0051929272b22ec0ce6881c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c8391a4c9a8ee2ad63d5314c9f4cde270d07d03a3bdaac2843208eacb6e5489a/contract';
import startContract from '../../snapshots/c8391a4c9a8ee2ad63d5314c9f4cde270d07d03a3bdaac2843208eacb6e5489a/contract.json' with { type: 'json' };
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
        table: 'payroll_audit_events',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollEntryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('payrollRunId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payroll_audit_events_action_check_8bd881ff',
            "\"action\" IN ('CREATED', 'CALCULATED', 'ADJUSTED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FINALIZED', 'PAYSLIP_GENERATED', 'PAYSLIP_FAILED', 'PAYMENT_RECORDED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_entries',
        columns: [
          col('baseAmount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('compensationType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('departmentName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('employeeCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('grossPay', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('jobTitle', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('netPay', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payFrequency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollRunId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payslipFailureCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('payslipKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('payslipStatus', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('salaryStructureId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('totalDeductions', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
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
            'payroll_entries_compensationType_check_1a0d65c2',
            "\"compensationType\" IN ('FIXED_SALARY', 'HOURLY')",
          ),
          checkExpression(
            'payroll_entries_payFrequency_check_01d702e4',
            "\"payFrequency\" IN ('MONTHLY', 'BIWEEKLY', 'WEEKLY')",
          ),
          checkExpression(
            'payroll_entries_payslipStatus_check_64ed587b',
            "\"payslipStatus\" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_entry_components',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isAdjustment', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollEntryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('sourceSalaryComponentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payroll_entry_components_type_check_950f4ce8',
            "\"type\" IN ('EARNING', 'DEDUCTION')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_payments',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('payrollEntryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recordedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_runs',
        columns: [
          col('approvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('approvedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('finalizedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('finalizedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('periodEnd', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('periodStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('totalDeductions', 'numeric(14,2)', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('totalGross', 'numeric(14,2)', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('totalNet', 'numeric(14,2)', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
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
            'payroll_runs_status_check_378c53d4',
            "\"status\" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'FINALIZED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_entries',
        constraint: 'payroll_entries_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_entries',
        constraint: 'payroll_entries_organizationId_payrollRunId_employeeId_key',
        columns: ['organizationId', 'payrollRunId', 'employeeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_payments',
        constraint: 'payroll_payments_organizationId_idempotencyKey_key',
        columns: ['organizationId', 'idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_runs',
        constraint: 'payroll_runs_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_audit_events',
        index: 'payroll_audit_events_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_audit_events',
        index: 'payroll_audit_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_audit_events',
        index: 'payroll_audit_events_organizationId_payrollEntryId_idx_3921d898',
        columns: ['organizationId', 'payrollEntryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_audit_events',
        index: 'payroll_audit_events_organizationId_payrollRunId_idx_81f419ba',
        columns: ['organizationId', 'payrollRunId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_audit_events',
        index: 'payroll_audit_run_idx',
        columns: ['organizationId', 'payrollRunId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_entries',
        index: 'payroll_entries_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_entries',
        index: 'payroll_entries_organizationId_payrollRunId_idx_81f419ba',
        columns: ['organizationId', 'payrollRunId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_entries',
        index: 'payroll_entries_organizationId_salaryStructureId_idx_a8fb92cd',
        columns: ['organizationId', 'salaryStructureId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_entries',
        index: 'payroll_entry_employee_idx',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_entry_components',
        index: 'payroll_component_entry_idx',
        columns: ['organizationId', 'payrollEntryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payments',
        index: 'payroll_payment_entry_idx',
        columns: ['organizationId', 'payrollEntryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payments',
        index: 'payroll_payments_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payments',
        index: 'payroll_payments_organizationId_recordedById_idx_c8e2f022',
        columns: ['organizationId', 'recordedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_runs',
        index: 'payroll_run_period_idx',
        columns: ['organizationId', 'periodStart', 'periodEnd'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_runs',
        index: 'payroll_run_status_idx',
        columns: ['organizationId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_runs',
        index: 'payroll_runs_organizationId_approvedById_idx_9cb35474',
        columns: ['organizationId', 'approvedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_runs',
        index: 'payroll_runs_organizationId_createdById_idx_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_runs',
        index: 'payroll_runs_organizationId_finalizedById_idx_03637749',
        columns: ['organizationId', 'finalizedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_runs',
        index: 'payroll_runs_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_audit_events',
        foreignKey: {
          name: 'payroll_audit_events_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_audit_events',
        foreignKey: {
          name: 'payroll_audit_events_organizationId_payrollRunId_fkey',
          columns: ['organizationId', 'payrollRunId'],
          references: {
            schema: 'public',
            table: 'payroll_runs',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_audit_events',
        foreignKey: {
          name: 'payroll_audit_events_organizationId_payrollEntryId_fkey',
          columns: ['organizationId', 'payrollEntryId'],
          references: {
            schema: 'public',
            table: 'payroll_entries',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_audit_events',
        foreignKey: {
          name: 'payroll_audit_events_organizationId_actorId_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_entries',
        foreignKey: {
          name: 'payroll_entries_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_entries',
        foreignKey: {
          name: 'payroll_entries_organizationId_payrollRunId_fkey',
          columns: ['organizationId', 'payrollRunId'],
          references: {
            schema: 'public',
            table: 'payroll_runs',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_entries',
        foreignKey: {
          name: 'payroll_entries_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_entries',
        foreignKey: {
          name: 'payroll_entries_organizationId_salaryStructureId_fkey',
          columns: ['organizationId', 'salaryStructureId'],
          references: {
            schema: 'public',
            table: 'salary_structures',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_entry_components',
        foreignKey: {
          name: 'payroll_entry_components_organizationId_payrollEntryId_fkey',
          columns: ['organizationId', 'payrollEntryId'],
          references: {
            schema: 'public',
            table: 'payroll_entries',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payments',
        foreignKey: {
          name: 'payroll_payments_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payments',
        foreignKey: {
          name: 'payroll_payments_organizationId_payrollEntryId_fkey',
          columns: ['organizationId', 'payrollEntryId'],
          references: {
            schema: 'public',
            table: 'payroll_entries',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payments',
        foreignKey: {
          name: 'payroll_payments_organizationId_recordedById_fkey',
          columns: ['organizationId', 'recordedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_runs',
        foreignKey: {
          name: 'payroll_runs_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_runs',
        foreignKey: {
          name: 'payroll_runs_organizationId_createdById_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_runs',
        foreignKey: {
          name: 'payroll_runs_organizationId_approvedById_fkey',
          columns: ['organizationId', 'approvedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_runs',
        foreignKey: {
          name: 'payroll_runs_organizationId_finalizedById_fkey',
          columns: ['organizationId', 'finalizedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
