#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/770c1f918c5d71729f73858dc0f8ee0c56d407c619f8727beb91da4741361756/contract';
import startContract from '../../snapshots/770c1f918c5d71729f73858dc0f8ee0c56d407c619f8727beb91da4741361756/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d51251a8c67afd97dd92aa72b9b47c14d04de3614162b0e2d52e077ab93998aa/contract';
import endContract from '../../snapshots/d51251a8c67afd97dd92aa72b9b47c14d04de3614162b0e2d52e077ab93998aa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'invoices',
        index: 'invoices_organizationId_dueDate_idx_e6fc0959',
        columns: ['organizationId', 'dueDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invoices',
        index: 'invoices_organizationId_issueDate_idx_523591b6',
        columns: ['organizationId', 'issueDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invoices',
        index: 'invoices_organizationId_status_issuedAt_idx_373463f5',
        columns: ['organizationId', 'status', 'issuedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payments',
        index: 'payments_organizationId_paymentDate_idx_bba58353',
        columns: ['organizationId', 'paymentDate'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
