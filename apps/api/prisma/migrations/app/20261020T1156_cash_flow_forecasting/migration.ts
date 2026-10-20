#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7a1e6ca649486c12b389e9af279fa96a420349ed903953cea971434206c7ace6/contract';
import startContract from '../../snapshots/7a1e6ca649486c12b389e9af279fa96a420349ed903953cea971434206c7ace6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/85a64e52dcfe897d4040dbab381261bafcac495b00d074c690ac2289c6c017c1/contract';
import endContract from '../../snapshots/85a64e52dcfe897d4040dbab381261bafcac495b00d074c690ac2289c6c017c1/contract.json' with { type: 'json' };
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
        table: 'cash_flow_forecast_audit_events',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('details', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'cash_flow_forecast_audit_events_action_check_171c9c49',
            '"action" IN (\'CONFIGURATION_UPDATED\')',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'cash_flow_forecast_configurations',
        columns: [
          col('conservativeDelayAdjustmentDays', 'int4', {
            notNull: true,
            default: lit(14),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('defaultHorizonDays', 'int4', {
            notNull: true,
            default: lit(30),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('expectedInvoiceCollectionDelay', 'int4', {
            notNull: true,
            default: lit(7),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('includeApprovedExpenses', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('includeApprovedPayroll', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('includeRecurringInvoices', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('includeSalaryEstimates', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('openingBalance', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('openingBalanceDate', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('optimisticDelayAdjustmentDays', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        ],
        constraints: [primaryKey(['organizationId'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cash_flow_forecast_audit_events',
        index: 'cash_flow_audit_actor_idx',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cash_flow_forecast_audit_events',
        index: 'cash_flow_audit_created_idx',
        columns: ['organizationId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cash_flow_forecast_audit_events',
        index: 'cash_flow_forecast_audit_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cash_flow_forecast_configurations',
        index: 'cash_flow_config_updater_idx',
        columns: ['organizationId', 'updatedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cash_flow_forecast_audit_events',
        foreignKey: {
          name: 'cash_flow_audit_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cash_flow_forecast_audit_events',
        foreignKey: {
          name: 'cash_flow_audit_actor_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cash_flow_forecast_configurations',
        foreignKey: {
          name: 'cash_flow_config_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cash_flow_forecast_configurations',
        foreignKey: {
          name: 'cash_flow_config_updater_fkey',
          columns: ['organizationId', 'updatedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
