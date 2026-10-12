#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b88d448873684081b756852cff15ea4827cafb47d4fa22b8871417ca2c91606b/contract';
import endContract from '../../snapshots/b88d448873684081b756852cff15ea4827cafb47d4fa22b8871417ca2c91606b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f2ee70e027cd89598d87bec91f125b6a3c6be501b574355a0744e49d6fb89e67/contract';
import startContract from '../../snapshots/f2ee70e027cd89598d87bec91f125b6a3c6be501b574355a0744e49d6fb89e67/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: 'public', table: 'invoices', column: col('issuedByUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }) }),
      this.addColumn({ schema: 'public', table: 'invoices', column: col('billingName', 'text', { codecRef: { codecId: 'pg/text@1' } }) }),
      this.addColumn({ schema: 'public', table: 'invoices', column: col('billingEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }) }),
      this.addColumn({ schema: 'public', table: 'invoices', column: col('billingCompanyName', 'text', { codecRef: { codecId: 'pg/text@1' } }) }),
      this.addColumn({ schema: 'public', table: 'invoices', column: col('billingTaxId', 'text', { codecRef: { codecId: 'pg/text@1' } }) }),
      this.addColumn({ schema: 'public', table: 'invoices', column: col('sellerName', 'text', { codecRef: { codecId: 'pg/text@1' } }) }),
      this.addColumn({ schema: 'public', table: 'invoices', column: col('currency', 'text', { codecRef: { codecId: 'pg/text@1' } }) }),
      this.addColumn({ schema: 'public', table: 'invoices', column: col('issuedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }) }),
      this.dropCheckConstraint({ schema: 'public', table: 'invoices', constraint: 'invoices_status_check_00f5804a' }),
      this.addCheckConstraint({ schema: 'public', table: 'invoices', constraint: 'invoices_status_check_1254a91c', expression: "\"status\" IN ('DRAFT', 'ISSUED', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED')" }),
      this.dropConstraint({ schema: 'public', table: 'invoices', constraint: 'invoices_organizationId_clientId_fkey' }),
      this.addForeignKey({ schema: 'public', table: 'invoices', foreignKey: { name: 'invoices_organizationId_clientId_fkey', columns: ['organizationId', 'clientId'], references: { schema: 'public', table: 'clients', columns: ['organizationId', 'id'] }, onDelete: 'restrict' } }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
