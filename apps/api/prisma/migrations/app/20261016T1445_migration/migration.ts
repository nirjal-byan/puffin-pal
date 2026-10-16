#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/06ad12ed557b56014279752e7307da50c77fbe0a9ec87671ec592afee19730dd/contract';
import startContract from '../../snapshots/06ad12ed557b56014279752e7307da50c77fbe0a9ec87671ec592afee19730dd/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7d8162694350372b4ab52d8bde6c7242904ab5455ae18b1c9e3be004d05de616/contract';
import endContract from '../../snapshots/7d8162694350372b4ab52d8bde6c7242904ab5455ae18b1c9e3be004d05de616/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'invoices',
        column: col('pdfKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
