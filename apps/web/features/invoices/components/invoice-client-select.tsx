"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Dropdown } from "../../../components/dropdown";
import { errorMessage, type Client, type WorkspaceApi } from "../../../lib/api";
export function InvoiceClientSelect({
  api,
  initialClient,
  value,
  onChange,
  error,
  disabled,
}: {
  api: WorkspaceApi;
  initialClient?: Client;
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled: boolean;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [revision, setRevision] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Client[]>("/clients?limit=100&offset=0", { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) {
          setClients(rows);
          setHasMore(rows.length === 100);
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(errorMessage(reason));
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [api, revision]);
  async function loadMore() {
    setLoadingMore(true);
    setFailure("");
    try {
      const rows = await api<Client[]>(`/clients?limit=100&offset=${clients.length}`);
      setClients((current) => [...current, ...rows]);
      setHasMore(rows.length === 100);
    } catch (reason) {
      setFailure(errorMessage(reason));
    } finally {
      setLoadingMore(false);
    }
  }
  const selected =
    clients.find((client) => client.id === value) ??
    (initialClient?.id === value ? initialClient : undefined);
  return (
    <section className="panel invoice-section">
      <div className="panel-heading">
        <h3>Client</h3>
        <span className="muted">Who is this invoice for?</span>
      </div>
      <div className="invoice-section-body">
        {loading ? (
          <p role="status" className="muted">
            Loading clients…
          </p>
        ) : clients.length === 0 && !failure ? (
          <div className="invoice-no-clients">
            <p>Add a client before creating an invoice.</p>
            <Link className="button secondary" href="/?section=clients">
              Go to clients →
            </Link>
          </div>
        ) : (
          <>
            <label className="invoice-field">
              Choose a client
              <Dropdown
                name="clientId"
                label="Choose a client"
                value={value}
                onChange={onChange}
                disabled={disabled || loading}
                invalid={Boolean(error)}
                describedBy={error ? "invoice-client-error" : undefined}
                placeholder="Select a client"
                searchPlaceholder="Search name, company, or email"
                options={clients.map((client) => ({
                  value: client.id,
                  label: client.name,
                  detail: [client.companyName, client.email].filter(Boolean).join(" · "),
                }))}
              />
            </label>
            {selected && (
              <p className="invoice-selected-client">
                <strong>{selected.name}</strong>
                <span>{selected.companyName || selected.email}</span>
                <small>{selected.email}</small>
              </p>
            )}
            {hasMore && (
              <button
                type="button"
                className="text-button"
                disabled={loadingMore || disabled}
                onClick={loadMore}
              >
                {loadingMore ? "Loading…" : "Load more clients"}
              </button>
            )}
          </>
        )}
        {failure && (
          <div className="alert" role="alert">
            {failure}
            <button
              className="text-button"
              type="button"
              disabled={disabled}
              onClick={() => {
                setLoading(true);
                setFailure("");
                setRevision((count) => count + 1);
              }}
            >
              Retry
            </button>
          </div>
        )}
        {error && (
          <p id="invoice-client-error" className="invoice-field-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
