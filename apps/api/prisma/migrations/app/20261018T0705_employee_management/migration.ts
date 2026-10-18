#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/619b2608801b7641e8d89cc99d143186ae40b5cdc28fb0ad1aec232d2d0b70e5/contract';
import startContract from '../../snapshots/619b2608801b7641e8d89cc99d143186ae40b5cdc28fb0ad1aec232d2d0b70e5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/940c4955e2c62f1ea130ef276b1e6571420080cd98a93010fa036b9602b13ed6/contract';
import endContract from '../../snapshots/940c4955e2c62f1ea130ef276b1e6571420080cd98a93010fa036b9602b13ed6/contract.json' with { type: 'json' };
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
        table: 'departments',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'employee_audit_events',
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
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'employee_audit_events_action_check_9545292c',
            "\"action\" IN ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'TERMINATED', 'SALARY_CREATED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'employees',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('departmentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('employeeCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employmentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('firstName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hireDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('jobTitle', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('linkedUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('managerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phoneNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('terminationDate', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
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
          col('workEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'employees_employmentType_check_a3ef5608',
            "\"employmentType\" IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')",
          ),
          checkExpression(
            'employees_status_check_fa83b510',
            "\"status\" IN ('ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'salary_components',
        columns: [
          col('amount', 'numeric(12,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('salaryStructureId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'salary_components_type_check_950f4ce8',
            "\"type\" IN ('EARNING', 'DEDUCTION')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'salary_structures',
        columns: [
          col('baseAmount', 'numeric(12,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('compensationType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('effectiveFrom', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('effectiveTo', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payFrequency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'salary_structures_compensationType_check_1a0d65c2',
            "\"compensationType\" IN ('FIXED_SALARY', 'HOURLY')",
          ),
          checkExpression(
            'salary_structures_payFrequency_check_01d702e4',
            "\"payFrequency\" IN ('MONTHLY', 'BIWEEKLY', 'WEEKLY')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'departments',
        constraint: 'departments_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'departments',
        constraint: 'departments_organizationId_name_key',
        columns: ['organizationId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'employees',
        constraint: 'employees_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'employees',
        constraint: 'employees_organizationId_employeeCode_key',
        columns: ['organizationId', 'employeeCode'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'employees',
        constraint: 'employees_organizationId_linkedUserId_key',
        columns: ['organizationId', 'linkedUserId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'salary_structures',
        constraint: 'salary_structures_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'departments',
        index: 'departments_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employee_audit_events',
        index: 'employee_audit_created_idx',
        columns: ['organizationId', 'employeeId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employee_audit_events',
        index: 'employee_audit_events_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employee_audit_events',
        index: 'employee_audit_events_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employee_audit_events',
        index: 'employee_audit_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employees',
        index: 'employees_organizationId_departmentId_idx_425ca78f',
        columns: ['organizationId', 'departmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employees',
        index: 'employees_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employees',
        index: 'employees_organizationId_managerId_idx_256b438c',
        columns: ['organizationId', 'managerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'employees',
        index: 'employees_organizationId_status_idx_21af5e82',
        columns: ['organizationId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salary_components',
        index: 'salary_component_structure_idx',
        columns: ['organizationId', 'salaryStructureId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salary_structures',
        index: 'salary_employee_effective_idx',
        columns: ['organizationId', 'employeeId', 'effectiveFrom'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salary_structures',
        index: 'salary_structures_organizationId_createdById_idx_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salary_structures',
        index: 'salary_structures_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salary_structures',
        index: 'salary_structures_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'departments',
        foreignKey: {
          name: 'departments_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'employee_audit_events',
        foreignKey: {
          name: 'employee_audit_events_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'employee_audit_events',
        foreignKey: {
          name: 'employee_audit_events_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'employee_audit_events',
        foreignKey: {
          name: 'employee_audit_events_organizationId_actorId_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'employees',
        foreignKey: {
          name: 'employees_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'employees',
        foreignKey: {
          name: 'employees_organizationId_departmentId_fkey',
          columns: ['organizationId', 'departmentId'],
          references: { schema: 'public', table: 'departments', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'employees',
        foreignKey: {
          name: 'employees_organizationId_managerId_fkey',
          columns: ['organizationId', 'managerId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'employees',
        foreignKey: {
          name: 'employees_organizationId_linkedUserId_fkey',
          columns: ['organizationId', 'linkedUserId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'salary_components',
        foreignKey: {
          name: 'salary_components_organizationId_salaryStructureId_fkey',
          columns: ['organizationId', 'salaryStructureId'],
          references: {
            schema: 'public',
            table: 'salary_structures',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'salary_structures',
        foreignKey: {
          name: 'salary_structures_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'salary_structures',
        foreignKey: {
          name: 'salary_structures_organizationId_employeeId_fkey',
          columns: ['organizationId', 'employeeId'],
          references: { schema: 'public', table: 'employees', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'salary_structures',
        foreignKey: {
          name: 'salary_structures_organizationId_createdById_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
