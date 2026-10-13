#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5a29f160413605151ec013754a85194d4af1fc1e83fca2d21b95727b01f42c24/contract';
import endContract from '../../snapshots/5a29f160413605151ec013754a85194d4af1fc1e83fca2d21b95727b01f42c24/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b88d448873684081b756852cff15ea4827cafb47d4fa22b8871417ca2c91606b/contract';
import startContract from '../../snapshots/b88d448873684081b756852cff15ea4827cafb47d4fa22b8871417ca2c91606b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('onboardingStatus', 'text', {
          notNull: true,
          default: lit('LEGACY'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('onboardingStep', 'text', {
          notNull: true,
          default: lit('welcome'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_onboardingStatus_check_d31e4e98',
        expression:
          "\"onboardingStatus\" IN ('LEGACY', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
