#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/85a64e52dcfe897d4040dbab381261bafcac495b00d074c690ac2289c6c017c1/contract';
import startContract from '../../snapshots/85a64e52dcfe897d4040dbab381261bafcac495b00d074c690ac2289c6c017c1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bc9d0b30b214355decab0d622e6d088a928e6f2db82aabc41803ccfd87498d2c/contract';
import endContract from '../../snapshots/bc9d0b30b214355decab0d622e6d088a928e6f2db82aabc41803ccfd87498d2c/contract.json' with { type: 'json' };
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
        table: 'payroll_notifications',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('dedupeKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('href', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('recipientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payroll_notifications_type_check_6de63b1b',
            "\"type\" IN ('DRAFT_READY', 'APPROVAL_PENDING', 'AUTOMATION_FAILED', 'PAYSLIPS_READY')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_schedule_events',
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
          col('scheduleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payroll_schedule_events_action_check_117b9500',
            "\"action\" IN ('CREATED', 'UPDATED', 'PAUSED', 'RESUMED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('failureCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('failureMessage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollRunId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('periodEnd', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('periodStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('scheduleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scheduledFor', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payroll_schedule_occurrences_source_check_5668e56e',
            "\"source\" IN ('SCHEDULED', 'MANUAL')",
          ),
          checkExpression(
            'payroll_schedule_occurrences_status_check_c63f1823',
            "\"status\" IN ('PENDING', 'PROCESSING', 'GENERATED', 'FAILED', 'CONFLICT', 'SKIPPED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_schedules',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('frequency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('generationTime', 'text', {
            notNull: true,
            default: lit('09:00'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastSuccessfulAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nextPeriodStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('nextRunAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentOffsetDays', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('periodAnchorDay', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('timezone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
            'payroll_schedules_frequency_check_d1aef24d',
            "\"frequency\" IN ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY')",
          ),
          checkExpression(
            'payroll_schedules_status_check_c5e40ebd',
            "\"status\" IN ('ACTIVE', 'PAUSED')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_runs',
        column: col('payrollScheduleId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_notifications',
        constraint: 'payroll_notification_dedupe_key',
        columns: ['organizationId', 'recipientId', 'dedupeKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_runs',
        constraint: 'payroll_run_schedule_period_key',
        columns: ['organizationId', 'payrollScheduleId', 'periodStart'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        constraint: 'payroll_occurrence_period_key',
        columns: ['organizationId', 'scheduleId', 'periodStart'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        constraint: 'payroll_occurrence_run_key',
        columns: ['organizationId', 'payrollRunId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_schedules',
        constraint: 'payroll_schedules_organizationId_key',
        columns: ['organizationId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_schedules',
        constraint: 'payroll_schedules_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_notifications',
        index: 'payroll_notification_inbox_idx',
        columns: ['organizationId', 'recipientId', 'readAt', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_notifications',
        index: 'payroll_notifications_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_notifications',
        index: 'payroll_notifications_organizationId_recipientId_idx_a231b775',
        columns: ['organizationId', 'recipientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_runs',
        index: 'payroll_runs_organizationId_payrollScheduleId_idx_a7849ad4',
        columns: ['organizationId', 'payrollScheduleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_events',
        index: 'payroll_schedule_event_history_idx',
        columns: ['organizationId', 'scheduleId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_events',
        index: 'payroll_schedule_events_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_events',
        index: 'payroll_schedule_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_events',
        index: 'payroll_schedule_events_organizationId_scheduleId_idx_a4ebe8f0',
        columns: ['organizationId', 'scheduleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        index: 'payroll_occurrence_due_idx',
        columns: ['status', 'scheduledFor'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        index: 'payroll_occurrence_history_idx',
        columns: ['organizationId', 'scheduleId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        index: 'payroll_schedule_occurrences_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        index: 'payroll_schedule_occurrences_organizationId_scheduleId_a4ebe8f0',
        columns: ['organizationId', 'scheduleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedules',
        index: 'payroll_schedule_due_idx',
        columns: ['status', 'nextRunAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_schedules',
        index: 'payroll_schedules_organizationId_createdById_idx_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_notifications',
        foreignKey: {
          name: 'payroll_notifications_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_notifications',
        foreignKey: {
          name: 'payroll_notifications_organizationId_recipientId_fkey',
          columns: ['organizationId', 'recipientId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_schedule_events',
        foreignKey: {
          name: 'payroll_schedule_events_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_schedule_events',
        foreignKey: {
          name: 'payroll_schedule_events_organizationId_scheduleId_fkey',
          columns: ['organizationId', 'scheduleId'],
          references: {
            schema: 'public',
            table: 'payroll_schedules',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_schedule_events',
        foreignKey: {
          name: 'payroll_schedule_events_organizationId_actorId_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        foreignKey: {
          name: 'payroll_schedule_occurrences_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        foreignKey: {
          name: 'payroll_schedule_occurrences_organizationId_scheduleId_fkey',
          columns: ['organizationId', 'scheduleId'],
          references: {
            schema: 'public',
            table: 'payroll_schedules',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_schedule_occurrences',
        foreignKey: {
          name: 'payroll_schedule_occurrences_organizationId_payrollRunId_fkey',
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
        table: 'payroll_schedules',
        foreignKey: {
          name: 'payroll_schedules_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_schedules',
        foreignKey: {
          name: 'payroll_schedules_organizationId_createdById_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_runs',
        foreignKey: {
          name: 'payroll_runs_organizationId_payrollScheduleId_fkey',
          columns: ['organizationId', 'payrollScheduleId'],
          references: {
            schema: 'public',
            table: 'payroll_schedules',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
