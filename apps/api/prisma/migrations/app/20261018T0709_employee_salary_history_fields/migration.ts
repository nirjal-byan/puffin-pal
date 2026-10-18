#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/940c4955e2c62f1ea130ef276b1e6571420080cd98a93010fa036b9602b13ed6/contract';
import startContract from '../../snapshots/940c4955e2c62f1ea130ef276b1e6571420080cd98a93010fa036b9602b13ed6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c8391a4c9a8ee2ad63d5314c9f4cde270d07d03a3bdaac2843208eacb6e5489a/contract';
import endContract from '../../snapshots/c8391a4c9a8ee2ad63d5314c9f4cde270d07d03a3bdaac2843208eacb6e5489a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
import { Temporal } from 'temporal-polyfill';
import 'temporal-polyfill/global';

const { sql: db, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'employee_audit_events',
        constraint: 'employee_audit_events_action_check_9545292c',
      }),
      this.addColumn({
        schema: 'public',
        table: 'employees',
        column: col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'salary_components',
        column: col('sortOrder', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'salary_structures',
        column: col('version', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'salary_structures',
        column: col('updatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.dataTransform(contract, 'backfill-salary_structures-updatedAt', {
        check: () => db.public.salary_structures.select('id').where((f, fns) => fns.eq(f.updatedAt, null)).limit(1),
        run: () => db.public.salary_structures.update({ updatedAt: Temporal.Instant.from('2026-10-18T00:00:00Z') }).where((f, fns) => fns.eq(f.updatedAt, null)),
      }),
      this.setNotNull({ schema: 'public', table: 'salary_structures', column: 'updatedAt' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'employee_audit_events',
        constraint: 'employee_audit_events_action_check_95de5bd1',
        expression:
          "\"action\" IN ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'TERMINATED', 'SALARY_CREATED', 'SALARY_REVISED', 'SALARY_SCHEDULED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
