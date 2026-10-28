import { AppModal } from "@/components/ui/app-modal";

export function GeneratePayrollDialog({
  busy,
  onClose,
  onGenerate,
}: {
  busy: boolean;
  onClose: () => void;
  onGenerate: () => void;
}) {
  return (
    <AppModal title="Generate payroll draft?" badge="Draft only" onClose={onClose}>
      <div className="confirmation-copy">
        <p>
          This queues the currently due period and calculates a draft using eligible employees and
          effective salary structures.
        </p>
        <p>No payroll will be approved, finalized, or paid.</p>
        <div className="form-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy} onClick={onGenerate}>
            Generate draft
          </button>
        </div>
      </div>
    </AppModal>
  );
}
