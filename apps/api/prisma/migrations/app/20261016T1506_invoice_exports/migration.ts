#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/770c1f918c5d71729f73858dc0f8ee0c56d407c619f8727beb91da4741361756/contract';
import endContract from '../../snapshots/770c1f918c5d71729f73858dc0f8ee0c56d407c619f8727beb91da4741361756/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7d8162694350372b4ab52d8bde6c7242904ab5455ae18b1c9e3be004d05de616/contract';
import startContract from '../../snapshots/7d8162694350372b4ab52d8bde6c7242904ab5455ae18b1c9e3be004d05de616/contract.json' with { type: 'json' };
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
        table: 'invoice_exports',
        columns: [
          col('archiveKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('archiveName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('archiveSize', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('failureCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invoiceIds', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('progress', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('requestFingerprint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestedByUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('QUEUED'),
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
            'invoice_exports_status_check_81add6e9',
            "\"status\" IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'invoice_exports',
        constraint: 'invoice_exports_organizationId_requestId_key',
        columns: ['organizationId', 'requestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invoice_exports',
        index: 'invoice_exports_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invoice_exports',
        index: 'invoice_exports_organizationId_requestedByUserId_idx_7a262416',
        columns: ['organizationId', 'requestedByUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invoice_exports',
        index: 'invoice_exports_status_expiresAt_idx_c206f415',
        columns: ['status', 'expiresAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'invoice_exports',
        foreignKey: {
          name: 'invoice_exports_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
