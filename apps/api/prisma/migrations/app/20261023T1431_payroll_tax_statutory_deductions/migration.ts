#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/acebefa7812ba1d4d8d946d5db9f3ae475a02c785a10ffa8202bb48c9cbeb0cd/contract';
import endContract from '../../snapshots/acebefa7812ba1d4d8d946d5db9f3ae475a02c785a10ffa8202bb48c9cbeb0cd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ba782965fb6c1a29e2ff42ecf9c4201008d69c6ee270373ac6e14a39c6d665dd/contract';
import startContract from '../../snapshots/ba782965fb6c1a29e2ff42ecf9c4201008d69c6ee270373ac6e14a39c6d665dd/contract.json' with { type: 'json' };
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
        table: 'payroll_entry_components',
        constraint: 'payroll_entry_components_type_check_950f4ce8',
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_statutory_applications',
        columns: [
          col('appliedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('appliedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('calculationSnapshot', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeContributions', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('employerContributions', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('grossEarnings', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inputHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('netPay', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('nonTaxableEarnings', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payrollEntryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('postTaxDeductions', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('preTaxDeductions', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('ruleSetId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taxWithholding', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('taxableEarnings', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('totalEmployerCost', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_statutory_audit_events',
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
        table: 'payroll_statutory_rule_sets',
        columns: [
          col('activatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('activatedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('effectiveFrom', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('effectiveTo', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('jurisdictionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('periodsPerYear', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payroll_statutory_rule_sets_status_check_280f52d9',
            "\"status\" IN ('DRAFT', 'ACTIVE', 'SUPERSEDED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_statutory_rules',
        columns: [
          col('calculationBase', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('calculationType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('contributionCap', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('fixedAmount', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('maximumBase', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('minimumBase', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rate', 'numeric(9,6)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 9, scale: 6 } },
          }),
          col('ruleSetId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payroll_statutory_rules_calculationBase_check_595c74e9',
            "\"calculationBase\" IN ('TAXABLE_EARNINGS', 'GROSS_EARNINGS')",
          ),
          checkExpression(
            'payroll_statutory_rules_calculationType_check_e26e54a5',
            "\"calculationType\" IN ('RATE', 'FIXED_AMOUNT')",
          ),
          checkExpression(
            'payroll_statutory_rules_kind_check_6d819a16',
            "\"kind\" IN ('FLAT_WITHHOLDING', 'EMPLOYEE_CONTRIBUTION', 'EMPLOYER_CONTRIBUTION')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_tax_brackets',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lowerBound', 'numeric(14,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rate', 'numeric(9,6)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 9, scale: 6 } },
          }),
          col('ruleSetId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('upperBound', 'numeric(14,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 14, scale: 2 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'payroll_tax_jurisdictions',
        columns: [
          col('countryCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('mandatoryCalculation', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subdivisionCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('taxYearStartDay', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('taxYearStartMonth', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
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
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('calculationSnapshot', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('statutoryClass', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('statutoryJurisdiction', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('statutoryRuleName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payroll_entry_components',
        column: col('statutoryRuleSetName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'salary_components',
        column: col('statutoryClass', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'payroll_entry_components',
        constraint: 'payroll_entry_components_statutoryClass_check_b7131461',
        expression:
          "\"statutoryClass\" IN ('TAXABLE_EARNING', 'NON_TAXABLE_EARNING', 'PRE_TAX_DEDUCTION', 'POST_TAX_DEDUCTION')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'payroll_entry_components',
        constraint: 'payroll_entry_components_type_check_55901ef6',
        expression: "\"type\" IN ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_statutory_applications',
        constraint: 'stat_app_entry_key',
        columns: ['organizationId', 'payrollEntryId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        constraint: 'payroll_statutory_rule_sets_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        constraint: 'stat_rule_version_key',
        columns: ['organizationId', 'jurisdictionId', 'name', 'version'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_tax_brackets',
        constraint: 'tax_bracket_order_key',
        columns: ['organizationId', 'ruleSetId', 'sortOrder'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_tax_jurisdictions',
        constraint: 'payroll_tax_jurisdictions_organizationId_id_key',
        columns: ['organizationId', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payroll_tax_jurisdictions',
        constraint: 'tax_jurisdiction_region_key',
        columns: ['organizationId', 'countryCode', 'subdivisionCode'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'salary_components',
        constraint: 'salary_components_statutoryClass_check_b7131461',
        expression:
          "\"statutoryClass\" IN ('TAXABLE_EARNING', 'NON_TAXABLE_EARNING', 'PRE_TAX_DEDUCTION', 'POST_TAX_DEDUCTION')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_applications',
        index: 'payroll_statutory_applications_organizationId_appliedB_d2def5ad',
        columns: ['organizationId', 'appliedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_applications',
        index: 'payroll_statutory_applications_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_applications',
        index: 'stat_app_rule_idx',
        columns: ['organizationId', 'ruleSetId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_audit_events',
        index: 'payroll_statutory_audit_events_organizationId_actorId__327c2974',
        columns: ['organizationId', 'actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_audit_events',
        index: 'payroll_statutory_audit_events_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_audit_events',
        index: 'stat_audit_entity_idx',
        columns: ['organizationId', 'entityType', 'entityId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        index: 'payroll_statutory_rule_sets_organizationId_activatedBy_5b72b40f',
        columns: ['organizationId', 'activatedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        index: 'payroll_statutory_rule_sets_organizationId_createdById_4fb80a04',
        columns: ['organizationId', 'createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        index: 'payroll_statutory_rule_sets_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        index: 'payroll_statutory_rule_sets_organizationId_jurisdictio_2477d924',
        columns: ['organizationId', 'jurisdictionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        index: 'stat_rule_effective_idx',
        columns: ['organizationId', 'jurisdictionId', 'status', 'effectiveFrom'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_statutory_rules',
        index: 'stat_item_rule_set_idx',
        columns: ['organizationId', 'ruleSetId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_tax_brackets',
        index: 'tax_bracket_rule_idx',
        columns: ['organizationId', 'ruleSetId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_tax_jurisdictions',
        index: 'payroll_tax_jurisdictions_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payroll_tax_jurisdictions',
        index: 'tax_jurisdiction_active_idx',
        columns: ['organizationId', 'isActive'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_applications',
        foreignKey: {
          name: 'stat_app_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_applications',
        foreignKey: {
          name: 'stat_app_entry_fkey',
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
        table: 'payroll_statutory_applications',
        foreignKey: {
          name: 'stat_app_rule_fkey',
          columns: ['organizationId', 'ruleSetId'],
          references: {
            schema: 'public',
            table: 'payroll_statutory_rule_sets',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_applications',
        foreignKey: {
          name: 'stat_app_actor_fkey',
          columns: ['organizationId', 'appliedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_audit_events',
        foreignKey: {
          name: 'stat_audit_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_audit_events',
        foreignKey: {
          name: 'stat_audit_actor_fkey',
          columns: ['organizationId', 'actorId'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        foreignKey: {
          name: 'stat_rule_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        foreignKey: {
          name: 'stat_rule_jurisdiction_fkey',
          columns: ['organizationId', 'jurisdictionId'],
          references: {
            schema: 'public',
            table: 'payroll_tax_jurisdictions',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        foreignKey: {
          name: 'stat_rule_creator_fkey',
          columns: ['organizationId', 'createdById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_rule_sets',
        foreignKey: {
          name: 'stat_rule_activator_fkey',
          columns: ['organizationId', 'activatedById'],
          references: { schema: 'public', table: 'users', columns: ['organizationId', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_statutory_rules',
        foreignKey: {
          name: 'stat_item_rule_set_fkey',
          columns: ['organizationId', 'ruleSetId'],
          references: {
            schema: 'public',
            table: 'payroll_statutory_rule_sets',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_tax_brackets',
        foreignKey: {
          name: 'tax_bracket_rule_fkey',
          columns: ['organizationId', 'ruleSetId'],
          references: {
            schema: 'public',
            table: 'payroll_statutory_rule_sets',
            columns: ['organizationId', 'id'],
          },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payroll_tax_jurisdictions',
        foreignKey: {
          name: 'tax_jurisdiction_org_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
