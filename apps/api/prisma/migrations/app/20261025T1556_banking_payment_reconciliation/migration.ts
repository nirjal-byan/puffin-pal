#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3e2878bed097dfdb8164710ad24a561d1792d7baafe2c150e42692accfa31039/contract';
import endContract from '../../snapshots/3e2878bed097dfdb8164710ad24a561d1792d7baafe2c150e42692accfa31039/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/acebefa7812ba1d4d8d946d5db9f3ae475a02c785a10ffa8202bb48c9cbeb0cd/contract';
import startContract from '../../snapshots/acebefa7812ba1d4d8d946d5db9f3ae475a02c785a10ffa8202bb48c9cbeb0cd/contract.json' with { type: 'json' };
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
        table: 'bank_accounts',
        columns: [
          col('accountHolder', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('bankName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('countryCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isDefault', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('maskedIdentifier', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'bank_reconciliations',
        columns: [
          col('bankTransactionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invoicePaymentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollPaymentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reconciledAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('reconciledById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reversalReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reversedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('reversedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('targetType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bank_reconciliations_targetType_check_8e3b2b9e',
            "\"targetType\" IN ('INVOICE_PAYMENT', 'PAYROLL_PAYMENT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'bank_transaction_imports',
        columns: [
          col('bankAccountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('duplicateCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('fileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('importedCount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rowCount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sourceHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('IMPORTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('uploadedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bank_transaction_imports_status_check_5fccdc0a',
            "\"status\" IN ('IMPORTED', 'PARTIALLY_IMPORTED', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'bank_transactions',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('bankAccountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('direction', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fingerprint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('importId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('transactionDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bank_transactions_direction_check_e45d5490',
            "\"direction\" IN ('CREDIT', 'DEBIT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'banking_audit_events',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('entityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('attemptedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('batchId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('employeeName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('payrollEntryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
            'payroll_payment_batch_items_status_check_66b410e6',
            "\"status\" IN ('PENDING', 'ATTEMPTED', 'PAID', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_payment_batches',
        columns: [
          col('bankAccountId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollRunId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('totalAmount', 'numeric(14,2)', {
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
            'payroll_payment_batches_status_check_391cf44f',
            "\"status\" IN ('DRAFT', 'PROCESSING', 'COMPLETED', 'CANCELLED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_accounts',
        constraint: 'bank_accounts_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_accounts',
        constraint: 'bank_account_name_key',
        columns: ['organizationId', 'displayName'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_reconciliations',
        constraint: 'bank_recon_invoice_key',
        columns: ['organizationId', 'invoicePaymentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_reconciliations',
        constraint: 'bank_recon_payroll_key',
        columns: ['organizationId', 'payrollPaymentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_reconciliations',
        constraint: 'bank_recon_tx_key',
        columns: ['organizationId', 'bankTransactionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_transaction_imports',
        constraint: 'bank_transaction_imports_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_transaction_imports',
        constraint: 'bank_import_source_key',
        columns: ['organizationId', 'bankAccountId', 'sourceHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_transactions',
        constraint: 'bank_transactions_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_transactions',
        constraint: 'bank_tx_fingerprint_key',
        columns: ['organizationId', 'bankAccountId', 'fingerprint'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        constraint: 'pay_batch_item_entry_key',
        columns: ['organizationId', 'payrollEntryId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_payment_batches',
        constraint: 'payroll_payment_batches_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_payments',
        constraint: 'payroll_payments_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_accounts',
        index: 'bank_account_active_idx',
        columns: ['organizationId', 'isActive'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_accounts',
        index: 'bank_accounts_organizationId_createdById_idx_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_accounts',
        index: 'bank_accounts_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_reconciliations',
        index: 'bank_recon_created_idx',
        columns: ['organizationId', 'reconciledAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_reconciliations',
        index: 'bank_reconciliations_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_reconciliations',
        index: 'bank_reconciliations_organizationId_reconciledById_idx_65721104',
        columns: ['organizationId', 'reconciledById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_reconciliations',
        index: 'bank_reconciliations_organizationId_reversedById_idx_d89ffd81',
        columns: ['organizationId', 'reversedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transaction_imports',
        index: 'bank_import_created_idx',
        columns: ['organizationId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transaction_imports',
        index: 'bank_transaction_imports_organizationId_bankAccountId__c169eff6',
        columns: ['organizationId', 'bankAccountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transaction_imports',
        index: 'bank_transaction_imports_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transaction_imports',
        index: 'bank_transaction_imports_organizationId_uploadedById_i_a9dad1c2',
        columns: ['organizationId', 'uploadedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transactions',
        index: 'bank_transactions_organizationId_bankAccountId_idx_c169eff6',
        columns: ['organizationId', 'bankAccountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transactions',
        index: 'bank_transactions_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transactions',
        index: 'bank_transactions_organizationId_importId_idx_ced03323',
        columns: ['organizationId', 'importId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_transactions',
        index: 'bank_tx_date_idx',
        columns: ['organizationId', 'transactionDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'banking_audit_events',
        index: 'bank_audit_entity_idx',
        columns: ['organizationId', 'entityType', 'entityId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'banking_audit_events',
        index: 'banking_audit_events_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'banking_audit_events',
        index: 'banking_audit_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        index: 'pay_batch_entry_idx',
        columns: ['organizationId', 'payrollEntryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        index: 'payroll_payment_batch_items_organizationId_batchId_idx_f085c214',
        columns: ['organizationId', 'batchId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        index: 'payroll_payment_batch_items_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batches',
        index: 'pay_batch_run_idx',
        columns: ['organizationId', 'payrollRunId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batches',
        index: 'payroll_payment_batches_organizationId_bankAccountId_i_c169eff6',
        columns: ['organizationId', 'bankAccountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batches',
        index: 'payroll_payment_batches_organizationId_createdById_idx_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batches',
        index: 'payroll_payment_batches_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_payment_batches',
        index: 'payroll_payment_batches_organizationId_payrollRunId_id_81f419ba',
        columns: ['organizationId', 'payrollRunId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_accounts',
        foreignKey: {
          name: 'bank_account_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_accounts',
        foreignKey: {
          name: 'bank_account_creator_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_reconciliations',
        foreignKey: {
          name: 'bank_recon_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_reconciliations',
        foreignKey: {
          name: 'bank_recon_tx_fkey',
          columns: ['organizationId', 'bankTransactionId'],
          references: {
            schema: 'public',
            table: 'bank_transactions',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_reconciliations',
        foreignKey: {
          name: 'bank_recon_invoice_fkey',
          columns: ['organizationId', 'invoicePaymentId'],
          references: { schema: 'public', table: 'payments', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_reconciliations',
        foreignKey: {
          name: 'bank_recon_payroll_fkey',
          columns: ['organizationId', 'payrollPaymentId'],
          references: {
            schema: 'public',
            table: 'payroll_payments',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_reconciliations',
        foreignKey: {
          name: 'bank_recon_actor_fkey',
          columns: ['organizationId', 'reconciledById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_reconciliations',
        foreignKey: {
          name: 'bank_recon_reverser_fkey',
          columns: ['organizationId', 'reversedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_transaction_imports',
        foreignKey: {
          name: 'bank_import_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_transaction_imports',
        foreignKey: {
          name: 'bank_import_account_fkey',
          columns: ['organizationId', 'bankAccountId'],
          references: {
            schema: 'public',
            table: 'bank_accounts',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_transaction_imports',
        foreignKey: {
          name: 'bank_import_uploader_fkey',
          columns: ['organizationId', 'uploadedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_transactions',
        foreignKey: {
          name: 'bank_tx_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_transactions',
        foreignKey: {
          name: 'bank_tx_account_fkey',
          columns: ['organizationId', 'bankAccountId'],
          references: {
            schema: 'public',
            table: 'bank_accounts',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_transactions',
        foreignKey: {
          name: 'bank_tx_import_fkey',
          columns: ['organizationId', 'importId'],
          references: {
            schema: 'public',
            table: 'bank_transaction_imports',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'banking_audit_events',
        foreignKey: {
          name: 'bank_audit_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'banking_audit_events',
        foreignKey: {
          name: 'bank_audit_actor_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        foreignKey: {
          name: 'pay_batch_item_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        foreignKey: {
          name: 'pay_batch_item_batch_fkey',
          columns: ['organizationId', 'batchId'],
          references: {
            schema: 'public',
            table: 'payroll_payment_batches',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payment_batch_items',
        foreignKey: {
          name: 'pay_batch_item_entry_fkey',
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
        table: 'payroll_payment_batches',
        foreignKey: {
          name: 'pay_batch_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payment_batches',
        foreignKey: {
          name: 'pay_batch_run_fkey',
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
        table: 'payroll_payment_batches',
        foreignKey: {
          name: 'pay_batch_account_fkey',
          columns: ['organizationId', 'bankAccountId'],
          references: {
            schema: 'public',
            table: 'bank_accounts',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_payment_batches',
        foreignKey: {
          name: 'pay_batch_creator_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
