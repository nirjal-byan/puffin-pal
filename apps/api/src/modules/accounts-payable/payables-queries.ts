import { BadRequestException } from "@nestjs/common";
import type { Database } from "../../infrastructure/database/client.js";
import type { PayablesQueryDto } from "./accounts-payable.dto.js";
import type { ExpenseQueryDto } from "../expenses/expense.dto.js";

export interface ResultPage<T = Record<string, unknown>> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  pendingCount?: number;
}
async function payload<T>(
  db: Database,
  plan: Parameters<ReturnType<Database["runtime"]>["query"]>[0],
): Promise<T> {
  const rows = (await db.runtime().query(plan)) as { payload: string }[];
  return JSON.parse(String(rows[0]!.payload)) as T;
}
export function validateRange(from?: string, to?: string) {
  if (from && to && from > to)
    throw new BadRequestException("From date must be on or before to date");
}
function assertSort(sort: string | undefined, allowed: readonly string[]) {
  if (sort && !allowed.includes(sort))
    throw new BadRequestException("Unsupported sort field for this list");
}
export function vendorPage(db: Database, organizationId: string, q: PayablesQueryDto) {
  assertSort(q.sort, ["name", "createdAt"]);
  return payload<ResultPage>(
    db,
    db.raw.sql`
    WITH filtered AS (
      SELECT v.* FROM vendors v WHERE v."organizationId"=${organizationId}
      AND (${q.active === undefined} OR v.active=${q.active ?? true})
      AND (${q.search ?? ""}='' OR strpos(lower(concat_ws(' ',v.name,v."displayName",v.email,v.phone)),lower(${q.search ?? ""}))>0)
    ), page AS (SELECT * FROM filtered ORDER BY
      CASE WHEN ${q.sort ?? "name"}='name' AND ${q.order ?? "asc"}='asc' THEN lower(name) END ASC,
      CASE WHEN ${q.sort ?? "name"}='name' AND ${q.order ?? "asc"}='desc' THEN lower(name) END DESC,
      CASE WHEN ${q.sort ?? "name"}='createdAt' AND ${q.order ?? "asc"}='asc' THEN "createdAt" END ASC,
      CASE WHEN ${q.sort ?? "name"}='createdAt' AND ${q.order ?? "asc"}='desc' THEN "createdAt" END DESC,
      id ASC LIMIT ${q.limit} OFFSET ${q.offset})
    SELECT json_build_object('items',COALESCE((SELECT json_agg(p) FROM page p),'[]'::json),'total',(SELECT count(*) FROM filtered),'limit',${q.limit}::int,'offset',${q.offset}::int)::text payload
  `
      .returnsRow({ payload: "pg/text@1" })
      .build(),
  );
}
export function billPage(db: Database, organizationId: string, today: string, q: PayablesQueryDto) {
  assertSort(q.sort, ["dueDate", "issueDate", "totalAmount", "balance"]);
  validateRange(q.from, q.to);
  return payload<ResultPage>(
    db,
    db.raw.sql`
    WITH base AS (
      SELECT b.*, COALESCE(v."displayName",v.name) "vendorName", COALESCE(p.paid,0) paid,
        GREATEST(b."totalAmount"-COALESCE(p.paid,0),0) balance,
        CASE WHEN COALESCE(p.paid,0)=0 THEN 'UNPAID' WHEN b."totalAmount"<=p.paid THEN 'PAID' ELSE 'PARTIALLY_PAID' END settlement
      FROM vendor_bills b JOIN vendors v ON v."organizationId"=b."organizationId" AND v.id=b."vendorId"
      LEFT JOIN LATERAL (SELECT SUM(amount) paid FROM payable_payments p WHERE p."organizationId"=b."organizationId" AND p."vendorBillId"=b.id AND p."reversedAt" IS NULL) p ON true
      WHERE b."organizationId"=${organizationId}
        AND (${q.vendorId ?? ""}='' OR b."vendorId"=${q.vendorId ?? ""})
        AND (${q.status ?? ""}='' OR b.status::text=${q.status ?? ""})
        AND (NULLIF(${q.from ?? ""},'')::date IS NULL OR b."dueDate">=NULLIF(${q.from ?? ""},'')::date)
        AND (NULLIF(${q.to ?? ""},'')::date IS NULL OR b."dueDate"<NULLIF(${q.to ?? ""},'')::date+1)
        AND (${q.search ?? ""}='' OR strpos(lower(concat_ws(' ',b."billNumber",b."vendorReference",b.description,v.name,v."displayName")),lower(${q.search ?? ""}))>0)
    ), filtered AS (SELECT * FROM base WHERE ${q.settlementStatus ?? ""}='' OR settlement=${q.settlementStatus ?? ""}),
    page AS (SELECT * FROM filtered ORDER BY
      CASE WHEN ${q.sort ?? "issueDate"}='dueDate' AND ${q.order ?? "desc"}='asc' THEN "dueDate" END ASC,
      CASE WHEN ${q.sort ?? "issueDate"}='dueDate' AND ${q.order ?? "desc"}='desc' THEN "dueDate" END DESC,
      CASE WHEN ${q.sort ?? "issueDate"}='issueDate' AND ${q.order ?? "desc"}='asc' THEN "issueDate" END ASC,
      CASE WHEN ${q.sort ?? "issueDate"}='issueDate' AND ${q.order ?? "desc"}='desc' THEN "issueDate" END DESC,
      CASE WHEN ${q.sort ?? "issueDate"}='totalAmount' AND ${q.order ?? "desc"}='asc' THEN "totalAmount" END ASC,
      CASE WHEN ${q.sort ?? "issueDate"}='totalAmount' AND ${q.order ?? "desc"}='desc' THEN "totalAmount" END DESC,
      CASE WHEN ${q.sort ?? "issueDate"}='balance' AND ${q.order ?? "desc"}='asc' THEN balance END ASC,
      CASE WHEN ${q.sort ?? "issueDate"}='balance' AND ${q.order ?? "desc"}='desc' THEN balance END DESC,
      id ASC LIMIT ${q.limit} OFFSET ${q.offset})
    SELECT json_build_object('items',COALESCE((SELECT json_agg(to_jsonb(p)-'paid'-'settlement'||jsonb_build_object(
      'totalAmount',p."totalAmount"::text,'subtotal',p.subtotal::text,'taxAmount',p."taxAmount"::text,'discountAmount',p."discountAmount"::text,
      'paidAmount',round(p.paid,2)::text,'balance',round(p.balance,2)::text,'settlementStatus',p.settlement,
      'overdue',p.status='APPROVED' AND p.balance>0 AND p."dueDate"<${today}::date)) FROM page p),'[]'::json),
      'total',(SELECT count(*) FROM filtered),'limit',${q.limit}::int,'offset',${q.offset}::int)::text payload
  `
      .returnsRow({ payload: "pg/text@1" })
      .build(),
  );
}
export function paymentPage(
  db: Database,
  organizationId: string,
  targetType: "EXPENSE" | "VENDOR_BILL",
  id: string,
  q: PayablesQueryDto,
) {
  assertSort(q.sort, ["paymentDate"]);
  validateRange(q.from, q.to);
  return payload<ResultPage>(
    db,
    db.raw.sql`
    WITH filtered AS (SELECT p.* FROM payable_payments p WHERE p."organizationId"=${organizationId}
      AND ((${targetType}='EXPENSE' AND p."expenseId"=${id}) OR (${targetType}='VENDOR_BILL' AND p."vendorBillId"=${id}))
      AND (${q.method ?? ""}='' OR p.method::text=${q.method ?? ""})
      AND (${q.reversalState ?? "ALL"}='ALL' OR (${q.reversalState ?? "ALL"}='ACTIVE' AND p."reversedAt" IS NULL) OR (${q.reversalState ?? "ALL"}='REVERSED' AND p."reversedAt" IS NOT NULL))
      AND (NULLIF(${q.from ?? ""},'')::date IS NULL OR p."paymentDate">=NULLIF(${q.from ?? ""},'')::date)
      AND (NULLIF(${q.to ?? ""},'')::date IS NULL OR p."paymentDate"<NULLIF(${q.to ?? ""},'')::date+1)
    ), page AS (SELECT * FROM filtered ORDER BY
      CASE WHEN ${q.order ?? "desc"}='asc' THEN "paymentDate" END ASC,
      CASE WHEN ${q.order ?? "desc"}='desc' THEN "paymentDate" END DESC,id ASC LIMIT ${q.limit} OFFSET ${q.offset})
    SELECT json_build_object('items',COALESCE((SELECT json_agg(to_jsonb(p)||jsonb_build_object('amount',p.amount::text)) FROM page p),'[]'::json),
    'total',(SELECT count(*) FROM filtered),'limit',${q.limit}::int,'offset',${q.offset}::int)::text payload
  `
      .returnsRow({ payload: "pg/text@1" })
      .build(),
  );
}
export function paymentTotals(
  db: Database,
  organizationId: string,
  targetType: "EXPENSE" | "VENDOR_BILL",
  id: string,
  currency?: string,
) {
  return payload<{ paidAmount: string }>(
    db,
    db.raw
      .sql`SELECT json_build_object('paidAmount',round(COALESCE(SUM(amount),0),2)::text)::text payload
    FROM payable_payments WHERE "organizationId"=${organizationId} AND "reversedAt" IS NULL
    AND (${currency ?? ""}='' OR currency=${currency ?? ""})
    AND ((${targetType}='EXPENSE' AND "expenseId"=${id}) OR (${targetType}='VENDOR_BILL' AND "vendorBillId"=${id}))
  `
      .returnsRow({ payload: "pg/text@1" })
      .build(),
  );
}
export function expensePage(db: Database, organizationId: string, q: ExpenseQueryDto, id?: string) {
  validateRange(q.from, q.to);
  return payload<ResultPage>(
    db,
    db.raw.sql`
    WITH base AS (
      SELECT e.*, b.id bill_id, COALESCE(b.currency,o.currency) settlement_currency,
        COALESCE(b."totalAmount",e.amount) settlement_total, COALESCE(p.paid,0) paid
      FROM expenses e JOIN organizations o ON o.id=e."organizationId"
      LEFT JOIN vendor_bills b ON b."organizationId"=e."organizationId" AND b."expenseId"=e.id
      LEFT JOIN LATERAL (SELECT SUM(p.amount) paid FROM payable_payments p
        WHERE p."organizationId"=e."organizationId" AND p."reversedAt" IS NULL AND p.currency=COALESCE(b.currency,o.currency)
        AND ((b.id IS NOT NULL AND p."vendorBillId"=b.id) OR (b.id IS NULL AND p."expenseId"=e.id))) p ON true
      WHERE e."organizationId"=${organizationId}
        AND (${id ?? ""}='' OR e.id=${id ?? ""})
        AND (${q.search ?? ""}='' OR strpos(lower(concat_ws(' ',e.title,e.description,e.vendor,e.notes)),lower(${q.search ?? ""}))>0)
        AND (${q.category ?? ""}='' OR e.category::text=${q.category ?? ""})
        AND (${q.submittedById ?? ""}='' OR e."submittedById"=${q.submittedById ?? ""})
        AND (NULLIF(${q.from ?? ""},'')::date IS NULL OR e.date>=NULLIF(${q.from ?? ""},'')::date)
        AND (NULLIF(${q.to ?? ""},'')::date IS NULL OR e.date<NULLIF(${q.to ?? ""},'')::date+1)
    ), states AS (SELECT *, CASE WHEN paid=0 THEN 'UNPAID' WHEN paid>=settlement_total THEN 'PAID' ELSE 'PARTIALLY_PAID' END settlement FROM base),
    filtered AS (SELECT * FROM states WHERE (${q.approvalStatus ?? ""}='' OR "approvalStatus"::text=${q.approvalStatus ?? ""})
      AND (${q.settlementStatus ?? ""}='' OR settlement=${q.settlementStatus ?? ""})),
    page AS (SELECT * FROM filtered ORDER BY
      CASE WHEN ${q.sort ?? "dueDate"}='date' AND ${q.order}='asc' THEN date END ASC, CASE WHEN ${q.sort ?? "dueDate"}='date' AND ${q.order}='desc' THEN date END DESC,
      CASE WHEN ${q.sort ?? "dueDate"}='title' AND ${q.order}='asc' THEN title END ASC, CASE WHEN ${q.sort ?? "dueDate"}='title' AND ${q.order}='desc' THEN title END DESC,
      CASE WHEN ${q.sort ?? "dueDate"}='amount' AND ${q.order}='asc' THEN amount END ASC, CASE WHEN ${q.sort ?? "dueDate"}='amount' AND ${q.order}='desc' THEN amount END DESC,
      CASE WHEN ${q.sort ?? "dueDate"}='createdAt' AND ${q.order}='asc' THEN "createdAt" END ASC, CASE WHEN ${q.sort ?? "dueDate"}='createdAt' AND ${q.order}='desc' THEN "createdAt" END DESC,
      id ASC LIMIT ${q.limit} OFFSET ${q.offset})
    SELECT json_build_object('items',COALESCE((SELECT json_agg(to_jsonb(p)-'receiptKey'-'receiptUrl'-'paid'-'settlement_total'-'settlement_currency'-'bill_id'-'settlement'||jsonb_build_object('amount',p.amount::text,
      'settlement',jsonb_build_object('linked',p.bill_id IS NOT NULL,'basis',CASE WHEN p.bill_id IS NULL THEN 'EXPENSE' ELSE 'BILL' END,
        'currency',p.settlement_currency,'totalAmount',p.settlement_total::text,'paidAmount',round(p.paid,2)::text,
        'balance',round(GREATEST(p.settlement_total-p.paid,0),2)::text,'settlementStatus',p.settlement))) FROM page p),'[]'::json),
      'total',(SELECT count(*) FROM filtered),'pendingCount',(SELECT count(*) FROM states WHERE "approvalStatus"='PENDING_APPROVAL'),
      'limit',${q.limit}::int,'offset',${q.offset}::int)::text payload
  `
      .returnsRow({ payload: "pg/text@1" })
      .build(),
  );
}
export function payableSummary(
  db: Database,
  organizationId: string,
  today: string,
  compact = false,
) {
  return payload<Record<string, unknown>>(
    db,
    db.raw.sql`
    WITH bills AS (SELECT b.*,COALESCE(v."displayName",v.name) vendor_name,GREATEST(b."totalAmount"-COALESCE(p.paid,0),0) balance,COALESCE(p.paid,0) paid,
      ${today}::date-b."dueDate"::date age
      FROM vendor_bills b JOIN vendors v ON v."organizationId"=b."organizationId" AND v.id=b."vendorId"
      LEFT JOIN LATERAL (SELECT SUM(amount) paid FROM payable_payments p WHERE p."organizationId"=b."organizationId" AND p."vendorBillId"=b.id AND p."reversedAt" IS NULL) p ON true
      WHERE b."organizationId"=${organizationId} AND b.status='APPROVED'),
    totals AS (SELECT COALESCE(SUM(balance),0) outstanding,COALESCE(SUM(balance) FILTER(WHERE age>0),0) overdue,
      COALESCE(SUM(balance) FILTER(WHERE age BETWEEN -7 AND 0),0) due7,COALESCE(SUM(balance) FILTER(WHERE age BETWEEN -30 AND 0),0) due30,
      COALESCE(SUM(balance) FILTER(WHERE age<=0),0) current,COALESCE(SUM(balance) FILTER(WHERE age BETWEEN 1 AND 30),0) d30,
      COALESCE(SUM(balance) FILTER(WHERE age BETWEEN 31 AND 60),0) d60,COALESCE(SUM(balance) FILTER(WHERE age BETWEEN 61 AND 90),0) d90,
      COALESCE(SUM(balance) FILTER(WHERE age>90),0) old,count(*) FILTER(WHERE paid>0 AND balance=0) paid_bills,
      count(*) FILTER(WHERE paid>0 AND balance>0) partial_bills FROM bills)
    SELECT json_build_object('outstanding',round(outstanding,2)::text,'overdue',round(overdue,2)::text,
      'dueWithin7Days',round(due7,2)::text,'dueWithin30Days',round(due30,2)::text,'paidBills',paid_bills,'partiallyPaidBills',partial_bills,
      'aging',json_build_object('current',round(current,2)::text,'days1to30',round(d30,2)::text,'days31to60',round(d60,2)::text,'days61to90',round(d90,2)::text,'over90',round(old,2)::text),
      'vendorBalances',CASE WHEN ${compact} THEN '[]'::json ELSE COALESCE((SELECT json_agg(x) FROM (SELECT "vendorId",max(vendor_name) vendor,round(SUM(balance),2)::text balance FROM bills GROUP BY "vendorId" HAVING SUM(balance)>0) x),'[]'::json) END,
      'recentPayments',COALESCE((SELECT json_agg(to_jsonb(p)||jsonb_build_object('amount',p.amount::text)) FROM (SELECT * FROM payable_payments WHERE "organizationId"=${organizationId} AND "reversedAt" IS NULL ORDER BY "paymentDate" DESC,id ASC LIMIT 10) p),'[]'::json))::text payload FROM totals
  `
      .returnsRow({ payload: "pg/text@1" })
      .build(),
  );
}
