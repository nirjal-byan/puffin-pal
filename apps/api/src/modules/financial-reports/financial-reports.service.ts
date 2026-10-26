import { BadRequestException, Inject, Injectable, Scope, UnauthorizedException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { DATABASE } from "../../infrastructure/database/database.module.js";
import type { Database } from "../../infrastructure/database/client.js";
import type { AuthenticatedRequest } from "../../common/types/auth.types.js";
import type { FinancialReportQueryDto } from "./financial-reports.dto.js";
import { validateReportRange } from "./financial-report-utils.js";
import { hasPermission } from "@puffinpal/permissions";

export type FinancialReport = {
  currency: string;
  period: { from: string; to: string; groupBy: string };
  basis: { name: string; disclosures: string[] };
  revenue: Record<string, unknown>;
  expenses: Record<string, unknown>;
  payroll: Record<string, unknown>;
  profitability: Record<string, unknown>;
  receivables: Record<string, unknown>;
  payables: Record<string, unknown>;
  cashMovement: Record<string, unknown>;
};

@Injectable({ scope: Scope.REQUEST })
export class FinancialReportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}

  async report(input: FinancialReportQueryDto): Promise<FinancialReport> {
    if (!this.request.auth) throw new UnauthorizedException();
    validateReportRange(input.from, input.to);
    const organizationId = this.request.auth.organizationId;
    const canReadPayroll = hasPermission(
      this.request.auth.role,
      "financial-reports:payroll-read",
    );
    const plan = this.db.raw.sql`
      WITH bounds AS (
        SELECT ${input.from}::date from_date, ${input.to}::date to_date,
          (${input.to}::date + 1) end_exclusive, ${input.groupBy}::text grain,
          ${input.currency}::text currency
      ),
      issued AS (
        SELECT i.*, c.name client_name, COALESCE(p.paid, 0) paid,
          GREATEST(i.total - COALESCE(p.paid, 0), 0) outstanding
        FROM invoices i
        JOIN clients c ON c."organizationId" = i."organizationId" AND c.id = i."clientId"
        CROSS JOIN bounds b
        LEFT JOIN LATERAL (
          SELECT SUM(amount) paid FROM payments
          WHERE "organizationId" = i."organizationId" AND "invoiceId" = i.id
            AND "paymentDate" < b.end_exclusive
        ) p ON true
        WHERE i."organizationId" = ${organizationId} AND i."issuedAt" IS NOT NULL
          AND i.status IN ('ISSUED','PAID','OVERDUE')
          AND COALESCE(i.currency, b.currency) = b.currency
          AND i."issueDate" < b.end_exclusive
      ),
      invoice_period AS (
        SELECT * FROM issued, bounds b
        WHERE "issueDate" >= b.from_date AND "issueDate" < b.end_exclusive
      ),
      payment_period AS (
        SELECT p.*, i.currency, c.name client_name,
          EXISTS (SELECT 1 FROM bank_reconciliations r
            WHERE r."organizationId" = p."organizationId" AND r."invoicePaymentId" = p.id
              AND r."reversedAt" IS NULL) reconciled
        FROM payments p
        JOIN invoices i ON i."organizationId" = p."organizationId" AND i.id = p."invoiceId"
        JOIN clients c ON c."organizationId" = i."organizationId" AND c.id = i."clientId"
        CROSS JOIN bounds b
        WHERE p."organizationId" = ${organizationId}
          AND COALESCE(i.currency, b.currency) = b.currency
          AND p."paymentDate" >= b.from_date AND p."paymentDate" < b.end_exclusive
      ),
      expense_period AS (
        SELECT e.* FROM expenses e, bounds b
        WHERE e."organizationId" = ${organizationId}
          AND e.date >= b.from_date AND e.date < b.end_exclusive
      ),
      finalized_payroll AS (
        SELECT pr.* FROM payroll_runs pr, bounds b
        WHERE pr."organizationId" = ${organizationId} AND pr.status = 'FINALIZED'
          AND pr.currency = b.currency
          AND pr."paymentDate" >= b.from_date AND pr."paymentDate" < b.end_exclusive
      ),
      payroll_paid AS (
        SELECT pp.*, pe."payrollRunId",
          EXISTS (SELECT 1 FROM bank_reconciliations r
            WHERE r."organizationId" = pp."organizationId" AND r."payrollPaymentId" = pp.id
              AND r."reversedAt" IS NULL) reconciled
        FROM payroll_payments pp
        JOIN payroll_entries pe ON pe."organizationId" = pp."organizationId" AND pe.id = pp."payrollEntryId"
        JOIN payroll_runs pr ON pr."organizationId" = pe."organizationId" AND pr.id = pe."payrollRunId"
        CROSS JOIN bounds b
        WHERE pp."organizationId" = ${organizationId} AND pr.currency = b.currency
          AND pp."paymentDate" >= b.from_date AND pp."paymentDate" < b.end_exclusive
      ),
      payroll_totals AS (
        SELECT COALESCE(SUM("totalGross"),0) gross,
          COALESCE(SUM("totalDeductions"),0) deductions,
          COALESCE(SUM("totalNet"),0) net
        FROM finalized_payroll
      ),
      employer_contributions AS (
        SELECT COALESCE(SUM(c.amount),0) amount
        FROM payroll_entry_components c
        JOIN payroll_entries pe ON pe."organizationId" = c."organizationId" AND pe.id = c."payrollEntryId"
        JOIN finalized_payroll pr ON pr.id = pe."payrollRunId"
        WHERE c.type = 'EMPLOYER_CONTRIBUTION'
      ),
      periods AS (
        SELECT date_trunc(CASE grain WHEN 'year' THEN 'year' WHEN 'quarter' THEN 'quarter' ELSE 'month' END,
          series)::date bucket
        FROM bounds b CROSS JOIN LATERAL generate_series(
          date_trunc(CASE grain WHEN 'year' THEN 'year' WHEN 'quarter' THEN 'quarter' ELSE 'month' END, from_date),
          to_date, CASE grain WHEN 'year' THEN interval '1 year' WHEN 'quarter' THEN interval '3 months' ELSE interval '1 month' END
        ) series
      ),
      trend AS (
        SELECT bucket,
          COALESCE((SELECT SUM(total) FROM invoice_period WHERE date_trunc(CASE (SELECT grain FROM bounds) WHEN 'year' THEN 'year' WHEN 'quarter' THEN 'quarter' ELSE 'month' END, "issueDate")::date = bucket),0) invoiced,
          COALESCE((SELECT SUM(amount) FROM payment_period WHERE date_trunc(CASE (SELECT grain FROM bounds) WHEN 'year' THEN 'year' WHEN 'quarter' THEN 'quarter' ELSE 'month' END, "paymentDate")::date = bucket),0) collected,
          COALESCE((SELECT SUM(amount) FROM expense_period WHERE "approvalStatus"='APPROVED' AND date_trunc(CASE (SELECT grain FROM bounds) WHEN 'year' THEN 'year' WHEN 'quarter' THEN 'quarter' ELSE 'month' END, date)::date = bucket),0) expenses,
          COALESCE((SELECT SUM("totalGross") FROM finalized_payroll WHERE date_trunc(CASE (SELECT grain FROM bounds) WHEN 'year' THEN 'year' WHEN 'quarter' THEN 'quarter' ELSE 'month' END, "paymentDate")::date = bucket),0) payroll
        FROM periods
      )
      SELECT json_build_object(
        'currency', ${input.currency}::text,
        'period', json_build_object('from',${input.from}::text,'to',${input.to}::text,'groupBy',${input.groupBy}::text),
        'basis', json_build_object('name','Operational Profitability Report','disclosures',json_build_array(
          'This is an operational report, not a GAAP or IFRS financial statement.',
          'Issued revenue uses invoice issue dates; collected revenue uses recorded payment dates.',
          'Approved expenses are not known to be paid because expense payment records do not exist.',
          'Accounts payable is unavailable because vendor bills are not modeled.',
          'No foreign-exchange conversion is performed.'
        )),
        'revenue', json_build_object(
          'issued', to_char(COALESCE((SELECT SUM(total) FROM invoice_period),0),'FM999999999999990.00'),
          'collected', to_char(COALESCE((SELECT SUM(amount) FROM payment_period),0),'FM999999999999990.00'),
          'outstanding', to_char(COALESCE((SELECT SUM(outstanding) FROM issued),0),'FM999999999999990.00'),
          'overdue', to_char(COALESCE((SELECT SUM(outstanding) FROM issued, bounds WHERE outstanding > 0 AND "dueDate" < to_date),0),'FM999999999999990.00'),
          'byClient', COALESCE((SELECT json_agg(x ORDER BY (x->>'amount')::numeric DESC) FROM (SELECT json_build_object('client',client_name,'amount',to_char(SUM(total),'FM999999999999990.00')) x FROM invoice_period GROUP BY client_name) q),'[]'::json),
          'byStatus', COALESCE((SELECT json_agg(json_build_object('status',status,'amount',to_char(amount,'FM999999999999990.00'))) FROM (SELECT status,SUM(total) amount FROM invoice_period GROUP BY status) q),'[]'::json)
        ),
        'expenses', json_build_object(
          'recorded', to_char(COALESCE((SELECT SUM(amount) FROM expense_period),0),'FM999999999999990.00'),
          'approved', to_char(COALESCE((SELECT SUM(amount) FROM expense_period WHERE "approvalStatus"='APPROVED'),0),'FM999999999999990.00'),
          'paid', NULL,
          'byCategory', COALESCE((SELECT json_agg(json_build_object('category',category,'amount',to_char(amount,'FM999999999999990.00')) ORDER BY amount DESC) FROM (SELECT category,SUM(amount) amount FROM expense_period WHERE "approvalStatus"='APPROVED' GROUP BY category) q),'[]'::json),
          'byVendor', COALESCE((SELECT json_agg(json_build_object('vendor',vendor,'amount',to_char(amount,'FM999999999999990.00')) ORDER BY amount DESC) FROM (SELECT COALESCE(vendor,'Unspecified') vendor,SUM(amount) amount FROM expense_period WHERE "approvalStatus"='APPROVED' GROUP BY vendor LIMIT 10) q),'[]'::json),
          'largest', COALESCE((SELECT json_agg(json_build_object('title',title,'vendor',vendor,'date',date::date::text,'amount',to_char(amount,'FM999999999999990.00')) ORDER BY amount DESC) FROM (SELECT * FROM expense_period WHERE "approvalStatus"='APPROVED' ORDER BY amount DESC LIMIT 10) q),'[]'::json)
        ),
        'payroll', json_build_object(
          'gross', to_char((SELECT gross FROM payroll_totals),'FM999999999999990.00'),
          'employeeDeductions', to_char((SELECT deductions FROM payroll_totals),'FM999999999999990.00'),
          'employerContributions', to_char((SELECT amount FROM employer_contributions),'FM999999999999990.00'),
          'net', to_char((SELECT net FROM payroll_totals),'FM999999999999990.00'),
          'paid', to_char(COALESCE((SELECT SUM(amount) FROM payroll_paid),0),'FM999999999999990.00'),
          'unpaidFinalized', to_char(GREATEST((SELECT net FROM payroll_totals)-COALESCE((SELECT SUM(amount) FROM payroll_paid),0),0),'FM999999999999990.00'),
          'employeeDetailAvailable', ${canReadPayroll}::boolean,
          'byEmployee', CASE WHEN ${canReadPayroll}::boolean THEN COALESCE((SELECT json_agg(json_build_object(
            'employee',"employeeName",'employeeCode',"employeeCode",'gross',to_char(gross,'FM999999999999990.00'),
            'deductions',to_char(deductions,'FM999999999999990.00'),'net',to_char(net,'FM999999999999990.00')
          ) ORDER BY gross DESC) FROM (SELECT pe."employeeName",pe."employeeCode",SUM(pe."grossPay") gross,
            SUM(pe."totalDeductions") deductions,SUM(pe."netPay") net FROM payroll_entries pe
            JOIN finalized_payroll pr ON pr.id=pe."payrollRunId" GROUP BY pe."employeeName",pe."employeeCode") q),'[]'::json) ELSE '[]'::json END
        ),
        'profitability', json_build_object(
          'basis','issued',
          'revenue',to_char(COALESCE((SELECT SUM(total) FROM invoice_period),0),'FM999999999999990.00'),
          'operatingCosts',to_char(COALESCE((SELECT SUM(amount) FROM expense_period WHERE "approvalStatus"='APPROVED'),0)+(SELECT gross FROM payroll_totals)+(SELECT amount FROM employer_contributions),'FM999999999999990.00'),
          'profit',to_char(COALESCE((SELECT SUM(total) FROM invoice_period),0)-COALESCE((SELECT SUM(amount) FROM expense_period WHERE "approvalStatus"='APPROVED'),0)-(SELECT gross FROM payroll_totals)-(SELECT amount FROM employer_contributions),'FM999999999999990.00'),
          'marginPercent', CASE WHEN COALESCE((SELECT SUM(total) FROM invoice_period),0)=0 THEN NULL ELSE to_char(
            100*(COALESCE((SELECT SUM(total) FROM invoice_period),0)-COALESCE((SELECT SUM(amount) FROM expense_period WHERE "approvalStatus"='APPROVED'),0)-(SELECT gross FROM payroll_totals)-(SELECT amount FROM employer_contributions))/
            (SELECT SUM(total) FROM invoice_period),'FM999999990.00') END
        ),
        'receivables', json_build_object(
          'aging', COALESCE((SELECT json_agg(json_build_object('bucket',bucket,'amount',to_char(amount,'FM999999999999990.00'),'count',count) ORDER BY ord) FROM (
            SELECT bucket,ord,COALESCE(SUM(outstanding),0) amount,COUNT(issued.id)::int count FROM (VALUES ('CURRENT',1),('1_30',2),('31_60',3),('61_90',4),('OVER_90',5)) b(bucket,ord)
            LEFT JOIN issued ON outstanding>0 AND bucket=CASE WHEN "dueDate"::date >= (SELECT to_date FROM bounds) THEN 'CURRENT' WHEN (SELECT to_date FROM bounds)-"dueDate"::date<=30 THEN '1_30' WHEN (SELECT to_date FROM bounds)-"dueDate"::date<=60 THEN '31_60' WHEN (SELECT to_date FROM bounds)-"dueDate"::date<=90 THEN '61_90' ELSE 'OVER_90' END GROUP BY bucket,ord
          ) q),'[]'::json),
          'byClient', COALESCE((SELECT json_agg(json_build_object('client',client_name,'amount',to_char(amount,'FM999999999999990.00')) ORDER BY amount DESC) FROM (SELECT client_name,SUM(outstanding) amount FROM issued WHERE outstanding>0 GROUP BY client_name) q),'[]'::json)
        ),
        'payables', json_build_object('available',false,'reason','Vendor bills and payable payments are not modeled.'),
        'cashMovement', json_build_object(
          'inflows',to_char(COALESCE((SELECT SUM(amount) FROM payment_period),0),'FM999999999999990.00'),
          'outflows',to_char(COALESCE((SELECT SUM(amount) FROM payroll_paid),0),'FM999999999999990.00'),
          'net',to_char(COALESCE((SELECT SUM(amount) FROM payment_period),0)-COALESCE((SELECT SUM(amount) FROM payroll_paid),0),'FM999999999999990.00'),
          'reconciledInflows',to_char(COALESCE((SELECT SUM(amount) FROM payment_period WHERE reconciled),0),'FM999999999999990.00'),
          'reconciledOutflows',to_char(COALESCE((SELECT SUM(amount) FROM payroll_paid WHERE reconciled),0),'FM999999999999990.00'),
          'forecastIncluded',false
        ),
        'trend', COALESCE((SELECT json_agg(json_build_object('period',bucket::text,'invoiced',to_char(invoiced,'FM999999999999990.00'),'collected',to_char(collected,'FM999999999999990.00'),'expenses',to_char(expenses,'FM999999999999990.00'),'payroll',to_char(payroll,'FM999999999999990.00'),'profit',to_char(invoiced-expenses-payroll,'FM999999999999990.00')) ORDER BY bucket) FROM trend),'[]'::json)
      )::text payload
    `.returnsRow({ payload: "pg/text@1" }).build();
    const row = (await this.db.runtime().query(plan))[0];
    if (!row) throw new BadRequestException("Reporting data is unavailable");
    return JSON.parse(row.payload) as FinancialReport;
  }
}
