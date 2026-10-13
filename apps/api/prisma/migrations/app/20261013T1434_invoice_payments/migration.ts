#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5a29f160413605151ec013754a85194d4af1fc1e83fca2d21b95727b01f42c24/contract';
import startContract from '../../snapshots/5a29f160413605151ec013754a85194d4af1fc1e83fca2d21b95727b01f42c24/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d34489e6ca7416e6e8951e1cd56d3a07d11d6bc6525e50e736d7f6a79e78a12e/contract';
import endContract from '../../snapshots/d34489e6ca7416e6e8951e1cd56d3a07d11d6bc6525e50e736d7f6a79e78a12e/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'payments',
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
          col('invoiceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('method', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('recordedByUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payments_method_check_4d18df7c',
            "\"method\" IN ('BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE', 'OTHER')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payments',
        constraint: 'payments_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payments',
        index: 'payments_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payments',
        index: 'payments_organizationId_invoiceId_idx_f9b6d255',
        columns: ['organizationId', 'invoiceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payments',
        foreignKey: {
          name: 'payments_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payments',
        foreignKey: {
          name: 'payments_organizationId_invoiceId_fkey',
          columns: ['organizationId', 'invoiceId'],
          references: { schema: 'public', table: 'invoices', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
