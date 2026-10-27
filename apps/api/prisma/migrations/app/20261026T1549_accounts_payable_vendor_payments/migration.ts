#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3e2878bed097dfdb8164710ad24a561d1792d7baafe2c150e42692accfa31039/contract';
import startContract from '../../snapshots/3e2878bed097dfdb8164710ad24a561d1792d7baafe2c150e42692accfa31039/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d895b37ad2d5cce1faa73c7bcd826e06ba66c2151357238235e7f722010d7bd4/contract';
import endContract from '../../snapshots/d895b37ad2d5cce1faa73c7bcd826e06ba66c2151357238235e7f722010d7bd4/contract.json' with { type: 'json' };
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
        table: 'bank_reconciliations',
        constraint: 'bank_reconciliations_targetType_check_8e3b2b9e',
      }),
      this.createTable({
        schema: 'public',
        table: 'payable_audit_events',
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
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payable_audit_events_action_check_15487a95',
            "\"action\" IN ('VENDOR_CREATED', 'VENDOR_UPDATED', 'VENDOR_ARCHIVED', 'BILL_CREATED', 'BILL_UPDATED', 'BILL_SUBMITTED', 'BILL_APPROVED', 'BILL_REJECTED', 'BILL_VOIDED', 'PAYMENT_RECORDED', 'PAYMENT_REVERSED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payable_payments',
        columns: [
          col('amount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('bankAccountId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expenseId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('method', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('recordedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reversalReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reversedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('reversedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('targetType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('vendorBillId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payable_payments_method_check_4d18df7c',
            "\"method\" IN ('BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE', 'OTHER')",
          ),
          checkExpression(
            'payable_payments_targetType_check_f438a128',
            "\"targetType\" IN ('VENDOR_BILL', 'EXPENSE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'vendor_bill_items',
        columns: [
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('discountAmount', 'numeric(14,2)', {
            notNull: true,
            default: lit('0.00'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lineTotal', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('quantity', 'numeric(12,4)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 4 } },
          }),
          col('taxAmount', 'numeric(14,2)', {
            notNull: true,
            default: lit('0.00'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('unitPrice', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('vendorBillId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'vendor_bills',
        columns: [
          col('approvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('approvedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('attachmentKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('attachmentMime', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('attachmentName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('attachmentSize', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('billNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('discountAmount', 'numeric(14,2)', {
            notNull: true,
            default: lit('0.00'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('dueDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expenseId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('issueDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rejectedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('submittedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('subtotal', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('taxAmount', 'numeric(14,2)', {
            notNull: true,
            default: lit('0.00'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('totalAmount', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('vendorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('vendorReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('voidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'vendor_bills_status_check_947a77c7',
            "\"status\" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'VOIDED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'vendors',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('country', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('defaultCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('displayName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentTermsDays', 'int4', {
            notNull: true,
            default: lit(30),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('taxId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('website', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'bank_reconciliations',
        column: col('payablePaymentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bank_reconciliations',
        constraint: 'bank_reconciliations_targetType_check_694f4f01',
        expression: "\"targetType\" IN ('INVOICE_PAYMENT', 'PAYROLL_PAYMENT', 'PAYABLE_PAYMENT')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'bank_reconciliations',
        constraint: 'bank_recon_payable_key',
        columns: ['organizationId', 'payablePaymentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payable_payments',
        constraint: 'payable_payments_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payable_payments',
        constraint: 'payable_payment_idempotency_key',
        columns: ['organizationId', 'idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vendor_bills',
        constraint: 'vendor_bills_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vendor_bills',
        constraint: 'vendor_bill_expense_key',
        columns: ['organizationId', 'expenseId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vendor_bills',
        constraint: 'vendor_bill_number_key',
        columns: ['organizationId', 'billNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vendors',
        constraint: 'vendors_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'vendors',
        constraint: 'vendor_name_key',
        columns: ['organizationId', 'name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_audit_events',
        index: 'payable_audit_entity_idx',
        columns: ['organizationId', 'entityType', 'entityId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_audit_events',
        index: 'payable_audit_events_organizationId_actorId_idx_327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_audit_events',
        index: 'payable_audit_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payment_bill_idx',
        columns: ['organizationId', 'vendorBillId', 'paymentDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payment_expense_idx',
        columns: ['organizationId', 'expenseId', 'paymentDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payments_organizationId_bankAccountId_idx_c169eff6',
        columns: ['organizationId', 'bankAccountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payments_organizationId_expenseId_idx_5740def0',
        columns: ['organizationId', 'expenseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payments_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payments_organizationId_recordedById_idx_c8e2f022',
        columns: ['organizationId', 'recordedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payments_organizationId_reversedById_idx_d89ffd81',
        columns: ['organizationId', 'reversedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payable_payments',
        index: 'payable_payments_organizationId_vendorBillId_idx_36296573',
        columns: ['organizationId', 'vendorBillId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bill_items',
        index: 'vendor_bill_item_position_idx',
        columns: ['organizationId', 'vendorBillId', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bill_items',
        index: 'vendor_bill_items_organizationId_vendorBillId_idx_36296573',
        columns: ['organizationId', 'vendorBillId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bills',
        index: 'vendor_bill_status_due_idx',
        columns: ['organizationId', 'status', 'dueDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bills',
        index: 'vendor_bill_vendor_status_idx',
        columns: ['organizationId', 'vendorId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bills',
        index: 'vendor_bills_organizationId_approvedById_idx_9cb35474',
        columns: ['organizationId', 'approvedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bills',
        index: 'vendor_bills_organizationId_createdById_idx_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bills',
        index: 'vendor_bills_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendor_bills',
        index: 'vendor_bills_organizationId_vendorId_idx_633a4102',
        columns: ['organizationId', 'vendorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendors',
        index: 'vendor_active_name_idx',
        columns: ['organizationId', 'active', 'name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vendors',
        index: 'vendors_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payable_audit_events',
        foreignKey: {
          name: 'payable_audit_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payable_audit_events',
        foreignKey: {
          name: 'payable_audit_actor_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payable_payments',
        foreignKey: {
          name: 'payable_payment_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payable_payments',
        foreignKey: {
          name: 'payable_payment_bill_fkey',
          columns: ['organizationId', 'vendorBillId'],
          references: {
            schema: 'public',
            table: 'vendor_bills',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payable_payments',
        foreignKey: {
          name: 'payable_payment_expense_fkey',
          columns: ['organizationId', 'expenseId'],
          references: { schema: 'public', table: 'expenses', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payable_payments',
        foreignKey: {
          name: 'payable_payment_account_fkey',
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
        table: 'payable_payments',
        foreignKey: {
          name: 'payable_payment_recorder_fkey',
          columns: ['organizationId', 'recordedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payable_payments',
        foreignKey: {
          name: 'payable_payment_reverser_fkey',
          columns: ['organizationId', 'reversedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_reconciliations',
        foreignKey: {
          name: 'bank_recon_payable_fkey',
          columns: ['organizationId', 'payablePaymentId'],
          references: {
            schema: 'public',
            table: 'payable_payments',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vendor_bill_items',
        foreignKey: {
          name: 'vendor_bill_item_bill_fkey',
          columns: ['organizationId', 'vendorBillId'],
          references: {
            schema: 'public',
            table: 'vendor_bills',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vendor_bills',
        foreignKey: {
          name: 'vendor_bill_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vendor_bills',
        foreignKey: {
          name: 'vendor_bill_vendor_fkey',
          columns: ['organizationId', 'vendorId'],
          references: { schema: 'public', table: 'vendors', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vendor_bills',
        foreignKey: {
          name: 'vendor_bill_expense_fkey',
          columns: ['organizationId', 'expenseId'],
          references: { schema: 'public', table: 'expenses', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vendor_bills',
        foreignKey: {
          name: 'vendor_bill_creator_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vendor_bills',
        foreignKey: {
          name: 'vendor_bill_approver_fkey',
          columns: ['organizationId', 'approvedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vendors',
        foreignKey: {
          name: 'vendor_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
