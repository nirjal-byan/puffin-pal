#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c4f998fa379b245c06e0e5056f7173488525226494dba5333e06f56adfdb6f0c/contract';
import endContract from '../../snapshots/c4f998fa379b245c06e0e5056f7173488525226494dba5333e06f56adfdb6f0c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d51251a8c67afd97dd92aa72b9b47c14d04de3614162b0e2d52e077ab93998aa/contract';
import startContract from '../../snapshots/d51251a8c67afd97dd92aa72b9b47c14d04de3614162b0e2d52e077ab93998aa/contract.json' with { type: 'json' };
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
        table: 'expense_approval_history',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expenseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('newStatus', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('previousStatus', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'expense_approval_history_action_check_8586241b',
            "\"action\" IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED', 'RESUBMITTED')",
          ),
          checkExpression(
            'expense_approval_history_newStatus_check_b818a279',
            "\"newStatus\" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')",
          ),
          checkExpression(
            'expense_approval_history_previousStatus_check_23699b52',
            "\"previousStatus\" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('approvalStatus', 'text', {
          notNull: true,
          default: lit('APPROVED'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('createdByUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('reviewedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('reviewedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('submittedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('submittedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('version', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'expenses',
        constraint: 'expenses_approvalStatus_check_bfafdfc7',
        expression: "\"approvalStatus\" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'expenses',
        constraint: 'expenses_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense_approval_history',
        index: 'expense_approval_history_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense_approval_history',
        index: 'expense_approval_history_organizationId_expenseId_idx_5740def0',
        columns: ['organizationId', 'expenseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense_approval_history',
        index: 'expense_approval_history_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense_approval_history',
        index: 'expense_history_expense_created_idx',
        columns: ['organizationId', 'expenseId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenses',
        index: 'expenses_organizationId_approvalStatus_submittedAt_idx_184f1a29',
        columns: ['organizationId', 'approvalStatus', 'submittedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenses',
        index: 'expenses_organizationId_createdByUserId_idx_a1ea2c41',
        columns: ['organizationId', 'createdByUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenses',
        index: 'expenses_organizationId_reviewedById_idx_82814071',
        columns: ['organizationId', 'reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenses',
        index: 'expenses_organizationId_submittedById_idx_944e86fb',
        columns: ['organizationId', 'submittedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expense_approval_history',
        foreignKey: {
          name: 'expense_approval_history_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expense_approval_history',
        foreignKey: {
          name: 'expense_approval_history_organizationId_expenseId_fkey',
          columns: ['organizationId', 'expenseId'],
          references: { schema: 'public', table: 'expenses', columns: ['organizationId', 'id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expense_approval_history',
        foreignKey: {
          name: 'expense_approval_history_organizationId_actorId_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenses',
        foreignKey: {
          name: 'expenses_organizationId_createdByUserId_fkey',
          columns: ['organizationId', 'createdByUserId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenses',
        foreignKey: {
          name: 'expenses_organizationId_reviewedById_fkey',
          columns: ['organizationId', 'reviewedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenses',
        foreignKey: {
          name: 'expenses_organizationId_submittedById_fkey',
          columns: ['organizationId', 'submittedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
