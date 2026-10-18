#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/619b2608801b7641e8d89cc99d143186ae40b5cdc28fb0ad1aec232d2d0b70e5/contract';
import endContract from '../../snapshots/619b2608801b7641e8d89cc99d143186ae40b5cdc28fb0ad1aec232d2d0b70e5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c4f998fa379b245c06e0e5056f7173488525226494dba5333e06f56adfdb6f0c/contract';
import startContract from '../../snapshots/c4f998fa379b245c06e0e5056f7173488525226494dba5333e06f56adfdb6f0c/contract.json' with { type: 'json' };
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
        table: 'recurring_invoice_items',
        columns: [
          col('amount', 'numeric(12,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('quantity', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('scheduleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('unitPrice', 'numeric(12,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
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
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invoiceId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scheduleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('scheduledFor', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
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
            'recurring_invoice_occurrences_status_check_4ed35ce9',
            "\"status\" IN ('PENDING', 'PROCESSING', 'GENERATED', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        columns: [
          col('autoIssue', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('clientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dueDateOffsetDays', 'int4', {
            notNull: true,
            default: lit(14),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('endDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('frequency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('interval', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('lastRunAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nextRunAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
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
            'recurring_invoice_schedules_frequency_check_b3f9f2fe',
            "\"frequency\" IN ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')",
          ),
          checkExpression(
            'recurring_invoice_schedules_status_check_e63cd711',
            "\"status\" IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'recurring_schedule_events',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
            'recurring_schedule_events_action_check_215e4b7d',
            "\"action\" IN ('CREATED', 'UPDATED', 'PAUSED', 'RESUMED', 'CANCELLED', 'OCCURRENCE_GENERATED', 'AUTO_ISSUED', 'GENERATION_FAILED', 'RETRIED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        constraint: 'recurring_invoice_occurrences_invoiceId_key',
        columns: ['invoiceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        constraint: 'recurring_occurrence_slot_key',
        columns: ['organizationId', 'scheduleId', 'scheduledFor'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        constraint: 'recurring_invoice_schedules_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_items',
        index: 'recurring_item_schedule_idx',
        columns: ['organizationId', 'scheduleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        index: 'recurring_invoice_occurrences_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        index: 'recurring_invoice_occurrences_organizationId_scheduleI_a4ebe8f0',
        columns: ['organizationId', 'scheduleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        index: 'recurring_occurrence_status_idx',
        columns: ['organizationId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        index: 'recurring_invoice_schedules_organizationId_createdById_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        index: 'recurring_invoice_schedules_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        index: 'recurring_invoice_schedules_status_nextRunAt_idx_c8293fec',
        columns: ['status', 'nextRunAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        index: 'recurring_schedule_client_idx',
        columns: ['organizationId', 'clientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_schedule_events',
        index: 'recurring_event_schedule_idx',
        columns: ['organizationId', 'scheduleId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_schedule_events',
        index: 'recurring_schedule_events_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_schedule_events',
        index: 'recurring_schedule_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurring_schedule_events',
        index: 'recurring_schedule_events_organizationId_scheduleId_id_a4ebe8f0',
        columns: ['organizationId', 'scheduleId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_invoice_items',
        foreignKey: {
          name: 'recurring_invoice_items_organizationId_scheduleId_fkey',
          columns: ['organizationId', 'scheduleId'],
          references: {
            schema: 'public',
            table: 'recurring_invoice_schedules',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        foreignKey: {
          name: 'recurring_invoice_occurrences_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        foreignKey: {
          name: 'recurring_invoice_occurrences_organizationId_scheduleId_fkey',
          columns: ['organizationId', 'scheduleId'],
          references: {
            schema: 'public',
            table: 'recurring_invoice_schedules',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_invoice_occurrences',
        foreignKey: {
          name: 'recurring_invoice_occurrences_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'invoices', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        foreignKey: {
          name: 'recurring_invoice_schedules_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        foreignKey: {
          name: 'recurring_invoice_schedules_organizationId_clientId_fkey',
          columns: ['organizationId', 'clientId'],
          references: { schema: 'public', table: 'clients', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_invoice_schedules',
        foreignKey: {
          name: 'recurring_invoice_schedules_organizationId_createdById_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_schedule_events',
        foreignKey: {
          name: 'recurring_schedule_events_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_schedule_events',
        foreignKey: {
          name: 'recurring_schedule_events_organizationId_scheduleId_fkey',
          columns: ['organizationId', 'scheduleId'],
          references: {
            schema: 'public',
            table: 'recurring_invoice_schedules',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurring_schedule_events',
        foreignKey: {
          name: 'recurring_schedule_events_organizationId_actorId_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
