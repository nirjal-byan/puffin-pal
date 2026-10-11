import DashboardEntry from "../../../features/pages/workspace/dashboard-entry";
export default async function InvoiceRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DashboardEntry initialTab="invoices" invoiceId={id} />;
}
