import { useState } from "react";
import { FormFilePicker, FormModal } from "@/components/ui/form-modal";
import { usePayableAction } from "../hooks/use-payable-action";
import {
  canChangeAttachment,
  downloadBillAttachment,
  removeBillAttachment,
  uploadBillAttachment,
  validateAttachment,
} from "../services/payables-api";
import type { AccountsPayableApi, VendorBillDetail } from "../types";

export function BillAttachmentsDialog({
  api,
  initialBill,
  canManage,
  onClose,
  onSaved,
}: {
  api: AccountsPayableApi;
  initialBill: VendorBillDetail;
  canManage: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [bill, setBill] = useState(initialBill);
  const [file, setFile] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const action = usePayableAction();
  const mutable = canManage && canChangeAttachment(bill.status);
  const fileError = file ? validateAttachment(file) : "";
  async function refresh(message: string) {
    // Attachment changes increment the bill version; always reload before another operation.
    setBill(await api<VendorBillDetail>(`/accounts-payable/bills/${bill.id}`));
    await onSaved(message);
  }
  return (
    <FormModal
      submitting={action.busy}
      title={`Attachment · ${bill.billNumber}`}
      onClose={() => {
        if (!action.busy) onClose();
      }}
    >
      <div aria-busy={action.busy}>
        {action.error && (
          <p className="form-alert error" role="alert">
            {action.error}
          </p>
        )}
        {action.busy && <p role="status">Working…</p>}
        <p>
          One private attachment per bill. Uploading a new file replaces the current attachment.
        </p>
        {bill.attachmentName ? (
          <>
            <p>
              <strong>{bill.attachmentName}</strong> · {bill.attachmentMime} ·{" "}
              {((bill.attachmentSize ?? 0) / 1024).toFixed(1)} KB
            </p>
            <button
              className="button secondary"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  const blob = await downloadBillAttachment(api, bill.id);
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = bill.attachmentName ?? "bill-attachment";
                  document.body.append(link);
                  link.click();
                  link.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                })
              }
            >
              Download attachment
            </button>
          </>
        ) : (
          <p>No attachment added.</p>
        )}
        {!mutable && (
          <p>
            Attachments can only be changed on draft or rejected bills by users with permission to
            manage bills.
          </p>
        )}
        {mutable && (
          <fieldset disabled={action.busy} style={{ border: 0, padding: 0 }}>
            <FormFilePicker
              key={bill.version}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              fileName={file?.name}
              hint="PDF, JPEG, PNG, WebP · Up to 5 MB"
              onChange={setFile}
            />
            {fileError && (
              <p className="field-error" role="alert">
                {fileError}
              </p>
            )}
            <button
              className="button primary"
              disabled={!file || !!fileError || action.busy}
              onClick={() =>
                void action.run(async () => {
                  if (!file) return;
                  await uploadBillAttachment(api, bill, file);
                  setFile(null);
                  await refresh("Bill attachment saved.");
                })
              }
            >
              {bill.attachmentName ? "Replace attachment" : "Upload attachment"}
            </button>
            {bill.attachmentName &&
              (confirmRemove ? (
                <div role="group" aria-label="Confirm attachment removal">
                  <p>Remove this attachment from the bill? This cannot be undone.</p>
                  <button className="button secondary" onClick={() => setConfirmRemove(false)}>
                    Keep attachment
                  </button>
                  <button
                    className="button danger"
                    onClick={() =>
                      void action.run(async () => {
                        await removeBillAttachment(api, bill);
                        setConfirmRemove(false);
                        await refresh("Bill attachment removed.");
                      })
                    }
                  >
                    Confirm removal
                  </button>
                </div>
              ) : (
                <button className="button secondary" onClick={() => setConfirmRemove(true)}>
                  Remove attachment
                </button>
              ))}
          </fieldset>
        )}
      </div>
    </FormModal>
  );
}
