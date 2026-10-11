#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/d41737e8db8b006b2f29f11b079d232f80e83a2c62ec80174990e0366ad0b6cb/contract';
import startContract from '../../snapshots/d41737e8db8b006b2f29f11b079d232f80e83a2c62ec80174990e0366ad0b6cb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f2ee70e027cd89598d87bec91f125b6a3c6be501b574355a0744e49d6fb89e67/contract';
import endContract from '../../snapshots/f2ee70e027cd89598d87bec91f125b6a3c6be501b574355a0744e49d6fb89e67/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'invoice_items',
        column: col('position', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'invoices',
        column: col('version', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
