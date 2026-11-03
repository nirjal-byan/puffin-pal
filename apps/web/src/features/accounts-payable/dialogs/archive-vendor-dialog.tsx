import { FormModal } from "@/components/ui/form-modal";
import { usePayableAction } from "../hooks/use-payable-action";
import { archiveVendor } from "../services/payables-api";
import type { AccountsPayableApi, Vendor } from "../types";

export function ArchiveVendorDialog({
  vendor,
  api,
  onClose,
  onSaved,
}: {
  vendor: Vendor;
  api: AccountsPayableApi;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const action = usePayableAction();
  return (
    <FormModal
      title="Archive vendor?"
      onClose={() => {
        if (!action.busy) onClose();
      }}
      onSubmit={() =>
        action.run(async () => {
          await archiveVendor(api, vendor.id);
          await onSaved();
          onClose();
        })
      }
      submitLabel="Archive vendor"
      submittingLabel="Archiving…"
      submitting={action.busy}
    >
      <p>
        <strong>{vendor.displayName || vendor.name}</strong>
      </p>
      <p>
        Archiving removes this vendor from new bill choices. Existing bills and financial history
        remain available. Vendors with outstanding balances cannot be archived.
      </p>
      {action.error && (
        <p className="form-alert error" role="alert">
          {action.error}
        </p>
      )}
    </FormModal>
  );
}
