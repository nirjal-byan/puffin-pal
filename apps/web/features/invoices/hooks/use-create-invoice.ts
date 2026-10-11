"use client";
import { useRef, useState } from "react";
import type { WorkspaceApi } from "../../../lib/api";
import {
  createInvoice,
  rememberCreatedInvoice,
  updateInvoice,
} from "../api/invoices";
import type {
  CreateInvoicePayload,
  InvoiceDetail,
} from "../types/invoice.types";
import { submissionGate } from "./submission-gate";
export function useCreateInvoice(api: WorkspaceApi, initial?: InvoiceDetail) {
  // Pin the version associated with the loaded form, even after token refresh.
  const original = useRef(initial).current;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const completed = useRef(false);
  const gate = useRef(submissionGate());
  async function save(input: CreateInvoicePayload) {
    if (completed.current) return undefined;
    return gate.current(async () => {
      setSaving(true);
      try {
        const invoice = original
          ? await updateInvoice(api, original.id, input, original.version)
          : await createInvoice(api, input);
        if (!original) rememberCreatedInvoice(invoice);
        completed.current = true;
        setSaved(true);
        return invoice;
      } finally {
        setSaving(false);
      }
    });
  }
  return { save, saving: saving || saved };
}
