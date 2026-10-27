import { AppModal } from "@/components/ui/app-modal";
import { InvoiceDetailPage } from "@/features/invoices/components/invoice-detail-page";
import { InvoiceForm } from "@/features/invoices/components/invoice-form";
import type { Permission } from "@puffinpal/permissions";
import type { WorkspaceApi } from "@/lib/api";

export function WorkspaceInvoiceModals({
  creating,
  editing,
  invoiceId,
  tutorialClient,
  api,
  permissions,
  currency,
  onNavigate,
}: {
  creating: boolean;
  editing: boolean;
  invoiceId?: string;
  tutorialClient: boolean;
  api: WorkspaceApi;
  permissions: readonly Permission[];
  currency: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <>
      {creating && permissions.includes("invoices:create") && (
        <AppModal title="Create invoice" badge="Draft" wide onClose={() => onNavigate("/invoices")}>
          <InvoiceForm
            api={api}
            modalActions
            onCreated={(invoice) =>
              onNavigate(tutorialClient ? `/invoices/${invoice.id}` : "/invoices")
            }
          />
        </AppModal>
      )}
      {editing && invoiceId && (
        <AppModal
          title="Edit draft invoice"
          badge="Draft"
          wide
          onClose={() => onNavigate(`/invoices/${invoiceId}`)}
        >
          <InvoiceDetailPage
            id={invoiceId}
            editing
            modal
            api={api}
            permissions={permissions}
            currency={currency}
          />
        </AppModal>
      )}
    </>
  );
}
