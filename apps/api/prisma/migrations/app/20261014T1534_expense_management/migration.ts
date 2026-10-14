#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/06ad12ed557b56014279752e7307da50c77fbe0a9ec87671ec592afee19730dd/contract';
import endContract from '../../snapshots/06ad12ed557b56014279752e7307da50c77fbe0a9ec87671ec592afee19730dd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d34489e6ca7416e6e8951e1cd56d3a07d11d6bc6525e50e736d7f6a79e78a12e/contract';
import startContract from '../../snapshots/d34489e6ca7416e6e8951e1cd56d3a07d11d6bc6525e50e736d7f6a79e78a12e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
import { Temporal } from 'temporal-polyfill';
import 'temporal-polyfill/global';

const { sql: db, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('receiptKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('receiptMime', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('receiptName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('receiptSize', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('vendor', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expenses',
        column: col('updatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.dataTransform(contract, 'backfill-expenses-updatedAt', {
        check: () => db.public.expenses.select('id').where((f, fns) => fns.eq(f.updatedAt, null)).limit(1),
        run: () => db.public.expenses.update({ updatedAt: Temporal.Instant.from('2026-10-14T00:00:00Z') }).where((f, fns) => fns.eq(f.updatedAt, null)),
      }),
      this.setNotNull({ schema: 'public', table: 'expenses', column: 'updatedAt' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
