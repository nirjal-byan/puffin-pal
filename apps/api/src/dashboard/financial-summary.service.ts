import {
  BadRequestException,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Temporal } from "temporal-polyfill";
import { DATABASE } from "../database.module.js";
import type { Database } from "../database/client.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import type { FinancialSummaryQueryDto } from "./financial-summary.dto.js";

export type DashboardGranularity = "day" | "week" | "month";

export function reportingRange(from: string, to: string) {
  try {
    const start = Temporal.PlainDate.from(from);
    const end = Temporal.PlainDate.from(to);
    const days = start.until(end, { largestUnit: "day" }).days;
    if (days < 0) throw new BadRequestException("from must be on or before to");
    if (days > 1_826)
      throw new BadRequestException("Reporting ranges cannot exceed five years");
    const granularity: DashboardGranularity =
      days <= 31 ? "day" : days <= 180 ? "week" : "month";
    return { granularity };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Provide valid from and to dates");
  }
}

@Injectable({ scope: Scope.REQUEST })
export class FinancialSummaryService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}

  async get(input: FinancialSummaryQueryDto) {
    if (!this.request.auth) throw new UnauthorizedException();
    const organizationId = this.request.auth.organizationId;
    const { granularity } = reportingRange(input.from, input.to);
    const plan = this.db.raw.sql`
      WITH bounds AS (
        SELECT ${input.from}::date AS from_date,
               ${input.to}::date AS to_date,
               (${input.to}::date + 1) AS end_exclusive,
               ${granularity}::text AS grain
      ),
      organization AS (
        SELECT currency FROM organizations WHERE id = ${organizationId}
      ),
      finalized AS (
        SELECT i.id, i.status, i."issueDate"::date AS issue_date,
               i."dueDate"::date AS due_date, i.total,
               CASE
                 WHEN i.status = 'PAID' AND p.payment_count = 0 THEN i.total
                 ELSE COALESCE(p.paid, 0)
               END AS paid_as_of
        FROM invoices i
        CROSS JOIN bounds b
        CROSS JOIN organization o
        LEFT JOIN LATERAL (
          SELECT SUM(amount) FILTER (WHERE "paymentDate" < b.end_exclusive) AS paid,
                 COUNT(*)::int AS payment_count
          FROM payments
          WHERE "organizationId" = ${organizationId}
            AND "invoiceId" = i.id
        ) p ON true
        WHERE i."organizationId" = ${organizationId}
          AND i."issuedAt" IS NOT NULL
          AND i."issuedAt" < b.end_exclusive
          AND i.status IN ('ISSUED', 'PAID', 'OVERDUE')
          AND i.currency = o.currency
      ),
      balances AS (
        SELECT *, GREATEST(total - paid_as_of, 0) AS outstanding
        FROM finalized
      ),
      buckets AS (
        SELECT series::date AS bucket_start,
               LEAST(
                 (series + CASE b.grain
                   WHEN 'day' THEN interval '1 day'
                   WHEN 'week' THEN interval '1 week'
                   ELSE interval '1 month'
                 END)::date,
                 b.end_exclusive
               ) AS bucket_end
        FROM bounds b
        CROSS JOIN LATERAL generate_series(
          date_trunc(b.grain, b.from_date)::date,
          date_trunc(b.grain, b.to_date)::date,
          CASE b.grain
            WHEN 'day' THEN interval '1 day'
            WHEN 'week' THEN interval '1 week'
            ELSE interval '1 month'
          END
        ) series
      ),
      trend AS (
        SELECT k.bucket_start,
          COALESCE((SELECT SUM(f.total) FROM finalized f
                    WHERE f.issue_date >= k.bucket_start AND f.issue_date < k.bucket_end), 0) AS revenue,
          COALESCE((SELECT SUM(p.amount) FROM payments p
                    JOIN invoices i ON i.id = p."invoiceId" AND i."organizationId" = p."organizationId"
                    CROSS JOIN organization o
                    WHERE p."organizationId" = ${organizationId}
                      AND i.currency = o.currency
                      AND p."paymentDate" >= k.bucket_start AND p."paymentDate" < k.bucket_end), 0) AS collections,
          COALESCE((SELECT SUM(e.amount) FROM expenses e
                    WHERE e."organizationId" = ${organizationId}
                      AND e."approvalStatus" = 'APPROVED'
                      AND e.date >= k.bucket_start AND e.date < k.bucket_end), 0) AS expenses
        FROM buckets k
      ),
      status_counts AS (
        SELECT status, COUNT(*)::int AS count FROM (
          SELECT 'DRAFT'::text AS status
          FROM invoices i, bounds b
          WHERE i."organizationId" = ${organizationId}
            AND i."createdAt" < b.end_exclusive
            AND (i.status = 'DRAFT' OR i."issuedAt" >= b.end_exclusive)
          UNION ALL
          SELECT CASE
            WHEN outstanding = 0 THEN 'PAID'
            WHEN due_date < (SELECT to_date FROM bounds) THEN 'OVERDUE'
            WHEN paid_as_of > 0 THEN 'PARTIALLY_PAID'
            ELSE 'ISSUED_UNPAID'
          END
          FROM balances
        ) statuses GROUP BY status
      ),
      expense_categories AS (
        SELECT categories.category,
               COALESCE(SUM(e.amount), 0) AS amount
        FROM (VALUES ('SOFTWARE'), ('HARDWARE'), ('TRAVEL'), ('MARKETING'), ('OTHER')) categories(category)
        CROSS JOIN bounds b
        LEFT JOIN expenses e ON e."organizationId" = ${organizationId}
          AND e."approvalStatus" = 'APPROVED'
          AND e.category = categories.category
          AND e.date >= b.from_date AND e.date < b.end_exclusive
        GROUP BY categories.category
      ),
      aging AS (
        SELECT bucket, COALESCE(SUM(outstanding), 0) AS amount,
               COUNT(*)::int AS count
        FROM (VALUES ('CURRENT'), ('1_30'), ('31_60'), ('61_90'), ('OVER_90')) labels(bucket)
        LEFT JOIN balances b ON b.outstanding > 0 AND labels.bucket = CASE
          WHEN b.due_date >= (SELECT to_date FROM bounds) THEN 'CURRENT'
          WHEN (SELECT to_date FROM bounds) - b.due_date <= 30 THEN '1_30'
          WHEN (SELECT to_date FROM bounds) - b.due_date <= 60 THEN '31_60'
          WHEN (SELECT to_date FROM bounds) - b.due_date <= 90 THEN '61_90'
          ELSE 'OVER_90'
        END
        GROUP BY bucket
      )
      SELECT json_build_object(
        'currency', (SELECT currency FROM organization),
        'range', json_build_object('from', ${input.from}::text, 'to', ${input.to}::text, 'granularity', ${granularity}::text),
        'metrics', json_build_object(
          'invoicedRevenue', to_char(COALESCE((SELECT SUM(total) FROM finalized, bounds
            WHERE issue_date >= from_date AND issue_date < end_exclusive), 0), 'FM999999999999990.00'),
          'paymentsReceived', to_char(COALESCE((SELECT SUM(p.amount) FROM payments p
            JOIN invoices i ON i.id = p."invoiceId" AND i."organizationId" = p."organizationId"
            CROSS JOIN bounds b CROSS JOIN organization o
            WHERE p."organizationId" = ${organizationId} AND i.currency = o.currency
              AND p."paymentDate" >= b.from_date AND p."paymentDate" < b.end_exclusive), 0), 'FM999999999999990.00'),
          'outstandingBalance', to_char(COALESCE((SELECT SUM(outstanding) FROM balances), 0), 'FM999999999999990.00'),
          'overdueBalance', to_char(COALESCE((SELECT SUM(outstanding) FROM balances, bounds
            WHERE outstanding > 0 AND due_date < to_date), 0), 'FM999999999999990.00'),
          'expenses', to_char(COALESCE((SELECT SUM(e.amount) FROM expenses e, bounds b
            WHERE e."organizationId" = ${organizationId}
              AND e."approvalStatus" = 'APPROVED'
              AND e.date >= b.from_date AND e.date < b.end_exclusive), 0), 'FM999999999999990.00'),
          'netCashFlow', to_char(
            COALESCE((SELECT SUM(p.amount) FROM payments p
              JOIN invoices i ON i.id = p."invoiceId" AND i."organizationId" = p."organizationId"
              CROSS JOIN bounds b CROSS JOIN organization o
              WHERE p."organizationId" = ${organizationId} AND i.currency = o.currency
                AND p."paymentDate" >= b.from_date AND p."paymentDate" < b.end_exclusive), 0)
            - COALESCE((SELECT SUM(e.amount) FROM expenses e, bounds b
              WHERE e."organizationId" = ${organizationId}
                AND e."approvalStatus" = 'APPROVED'
                AND e.date >= b.from_date AND e.date < b.end_exclusive), 0),
            'FM999999999999990.00')
        ),
        'trend', COALESCE((SELECT json_agg(json_build_object(
          'date', bucket_start::text,
          'revenue', to_char(revenue, 'FM999999999999990.00'),
          'collections', to_char(collections, 'FM999999999999990.00'),
          'expenses', to_char(expenses, 'FM999999999999990.00')
        ) ORDER BY bucket_start) FROM trend), '[]'::json),
        'invoiceStatuses', COALESCE((SELECT json_agg(json_build_object('status', status, 'count', count) ORDER BY status)
          FROM status_counts), '[]'::json),
        'expenseCategories', COALESCE((SELECT json_agg(json_build_object(
          'category', category, 'amount', to_char(amount, 'FM999999999999990.00')) ORDER BY category)
          FROM expense_categories), '[]'::json),
        'aging', COALESCE((SELECT json_agg(json_build_object(
          'bucket', bucket, 'amount', to_char(amount, 'FM999999999999990.00'), 'count', count) ORDER BY bucket)
          FROM aging), '[]'::json)
      )::text AS payload
    `.returnsRow({ payload: "pg/text@1" }).build();
    const rows = await this.db.runtime().query(plan);
    const row = rows[0];
    if (!row) throw new BadRequestException("Organization reporting data is unavailable");
    return JSON.parse(row.payload) as unknown;
  }
}
