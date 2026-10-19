#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/205b388ad73b6fc2fe5b0bc4eebb8e89bdbaeec2c0051929272b22ec0ce6881c/contract';
import startContract from '../../snapshots/205b388ad73b6fc2fe5b0bc4eebb8e89bdbaeec2c0051929272b22ec0ce6881c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dfb9f0d1f85b9778eec823be2a74f373e3359cfbe6c8562591a52c5c75b8ffb1/contract';
import endContract from '../../snapshots/dfb9f0d1f85b9778eec823be2a74f373e3359cfbe6c8562591a52c5c75b8ffb1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
import 'temporal-polyfill/global';

const { sql: db, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'payroll_runs',
        column: col('organizationName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-payroll_runs-organizationName', {
        check: () => db.public.payroll_runs.select('id').where((fields, operators) => operators.eq(fields.organizationName, null)).limit(1),
        run: () => db.public.payroll_runs.update({ organizationName: 'Organization' }).where((fields, operators) => operators.eq(fields.organizationName, null)),
      }),
      this.setNotNull({ schema: 'public', table: 'payroll_runs', column: 'organizationName' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
