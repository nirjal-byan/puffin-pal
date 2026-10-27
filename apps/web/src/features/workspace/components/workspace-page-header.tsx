import Link from "next/link";
import type { Permission } from "@puffinpal/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DESCRIPTION, type Tab } from "@/lib/navigation";

export function WorkspacePageHeader({
  tab,
  invoiceId,
  creatingInvoice,
  title,
  organizationName,
  permissions,
  allowed,
  loading,
  onReload,
}: {
  tab: Tab;
  invoiceId?: string;
  creatingInvoice: boolean;
  title: string;
  organizationName: string;
  permissions: readonly Permission[];
  allowed: boolean;
  loading: boolean;
  onReload: () => void;
}) {
  if (tab === "overview") return null;
  const canCreateInvoice = permissions.includes("invoices:create");
  const hidesRefresh = [
    "overview",
    "access",
    "profile",
    "password",
    "cash-flow",
    "banking",
    "payroll",
    "payroll-automation",
  ].includes(tab);
  return (
    <PageHeader
      eyebrow={organizationName}
      title={
        invoiceId ? "Invoice Details" : title === "My access" ? "Your workspace access" : title
      }
      description={DESCRIPTION[tab]}
      actions={
        <>
          {!creatingInvoice && !invoiceId && tab === "invoices" && canCreateInvoice && (
            <Link className="button primary" href="/invoices/new" data-tour="create-invoice">
              + Create Invoice
            </Link>
          )}
          {!creatingInvoice && !invoiceId && !hidesRefresh && allowed && (
            <button
              className="button secondary"
              type="button"
              onClick={onReload}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          )}
        </>
      }
    />
  );
}
