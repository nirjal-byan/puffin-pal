"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { InvoiceDetailPage } from "../../invoices/components/invoice-detail-page";
import { InvoiceForm } from "../../invoices/components/invoice-form";
import { recentlyCreatedInvoice } from "../../invoices/api/invoices";
import type { Permission } from "@puffinpal/permissions";
import {
  ApiError,
  apiRequest,
  errorMessage,
  roleLabel,
  type Client,
  type FinancialRecord,
  type Member,
  type Profile,
  type Session,
} from "../../../lib/api";
import type { WorkspaceApi } from "../../../lib/api";
import {
  NAV,
  DESCRIPTION,
  sectionForTab,
  resolveTab,
  tabHref,
  type Tab,
} from "../../../lib/navigation";
import { CompanyLogoSettings } from "../../../components/company-logo-settings";
import { Navbar } from "../../../components/navbar";
import { Sidebar } from "../../../components/sidebar";
import { Footer } from "../../../components/footer";
import WorkspaceLayout from "./layout";
import OverviewPage from "../overview/page";
import ClientsPage from "../clients/page";
import TeamPage from "../team/page";
import AccessPage from "../access/page";
import EditProfilePage from "../edit-profile/page";
import ChangePasswordPage from "../change-password/page";
import InvoicesPage from "../invoices/page";
import ExpensesPage from "../expenses/page";
import RetainersPage from "../retainers/page";

export default function WorkspacePage({
  session,
  onSignOut,
  onProfileChange,
  initialTab,
  creatingInvoice = false,
  invoiceId,
  editingInvoice = false,
}: {
  session: Session;
  initialTab?: Tab;
  creatingInvoice?: boolean;
  invoiceId?: string;
  editingInvoice?: boolean;
  onSignOut: (expired?: boolean) => void;
  onProfileChange: (profile: Profile) => void;
}) {
  const router = useRouter();
  const recentDraft = recentlyCreatedInvoice(session.organization.id);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = localStorage.getItem("puffinpal-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [notifications, setNotifications] = useState<string[]>([]);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem("puffinpal-theme", next);
    } catch {}
  }
  function recordNotification(message: string) {
    setNotice(message);
    setNotifications((items) => [message, ...items].slice(0, 20));
  }
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = resolveTab(pathname, searchParams.get("section"), initialTab);
  const activeSection = sectionForTab(tab, searchParams.get("area"));
  const [previousTab, setPreviousTab] = useState(tab);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<(Client | Member | FinancialRecord)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const can = (permission: Permission) =>
    session.permissions.includes(permission);
  const currentNav = NAV.find((item) => item.key === tab)!;
  const allowed = can(currentNav.permission);
  const api: WorkspaceApi = useCallback(
    async <T,>(
      path: string,
      options?: { method?: string; body?: unknown; signal?: AbortSignal },
    ) => {
      try {
        return await apiRequest<T>(path, {
          ...options,
          token: session.accessToken,
        });
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401)
          onSignOut(true);
        throw failure;
      }
    },
    [session.accessToken, onSignOut],
  );
  useEffect(() => {
    if (
      creatingInvoice ||
      invoiceId ||
      ["overview", "access", "profile", "password"].includes(tab) ||
      !allowed
    )
      return;
    const controller = new AbortController();
    api<(Client | Member | FinancialRecord)[]>(
      `/${tab}?limit=20&offset=${offset}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setRows(data);
          setLoading(false);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(failure));
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [tab, offset, revision, api, allowed, creatingInvoice, invoiceId]);
  // Reset page-specific state when URL navigation (including history) changes tabs.
  if (previousTab !== tab) {
    setPreviousTab(tab);
    setOffset(0);
    setRows([]);
    setError("");
    setNotice("");
    setLoading(true);
    setLoadFailed(false);
  }
  function navigate(next: Tab) {
    router.push(tabHref(next));
  }
  function reload() {
    setLoadFailed(false);
    setLoading(true);
    setError("");
    setRevision((current) => current + 1);
  }
  function saved(message: string) {
    recordNotification(message);
    reload();
  }
  async function refreshAccess() {
    setRefreshing(true);
    setError("");
    try {
      onProfileChange(await api<Profile>("/auth/me"));
      setNotice("Your access is up to date.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setRefreshing(false);
    }
  }
  const CurrentSettingsPage =
    tab === "password" ? ChangePasswordPage : EditProfilePage;
  const CurrentFinancialPage =
    tab === "expenses"
      ? ExpensesPage
      : tab === "retainers"
        ? RetainersPage
        : InvoicesPage;
  return (
    <WorkspaceLayout theme={theme}>
      <Navbar
        session={session}
        tab={tab}
        area={activeSection.key}
        theme={theme}
        toggleTheme={toggleTheme}
        notifications={notifications}
        onClearNotifications={() => setNotifications([])}
      />
      <Sidebar
        session={session}
        tab={tab}
        area={activeSection.key}
        onSignOut={() => onSignOut()}
      />
      <main className="workspace-main">
        <header className="topbar">
          <span>
            {activeSection.label} <span className="breadcrumb">/</span>{" "}
            {invoiceId
              ? editingInvoice
                ? "Edit Draft"
                : "Invoice Details"
              : creatingInvoice
                ? "Create Invoice"
                : currentNav.label}
          </span>
          <span className="topbar-slug">{session.organization.slug}</span>
        </header>
        <div
          key={`${tab}-${creatingInvoice}`}
          className="workspace-content page-transition"
        >
          <div className="page-heading">
            <div>
              <span className="eyebrow">{session.organization.name}</span>
              <h1>
                {invoiceId
                  ? editingInvoice
                    ? "Edit Draft"
                    : "Invoice Details"
                  : creatingInvoice
                    ? "Create Invoice"
                    : currentNav.label === "My access"
                      ? "Your workspace access"
                      : currentNav.label}
              </h1>
              <p className="muted">
                {creatingInvoice
                  ? "Build an invoice and save it as a draft."
                  : DESCRIPTION[tab]}
              </p>
            </div>
            <div className="page-heading-actions">
              {!creatingInvoice &&
                !invoiceId &&
                tab === "invoices" &&
                can("invoices:create") && (
                  <Link className="button primary" href="/invoices/new">
                    + Create Invoice
                  </Link>
                )}
              {!creatingInvoice &&
                !invoiceId &&
                !["overview", "access", "profile", "password"].includes(tab) &&
                allowed && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={reload}
                    disabled={loading}
                  >
                    ↻ Refresh
                  </button>
                )}
            </div>
          </div>
          <div className="workspace-context">
            <span>
              <span className="context-dot" aria-hidden="true" />
              {session.organization.name}
            </span>
            <span>{roleLabel(session.role)} access</span>
            <span>{session.organization.currency}</span>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button
                type="button"
                className="text-button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}
          {!creatingInvoice &&
            !invoiceId &&
            tab === "invoices" &&
            recentDraft && (
              <section className="panel invoice-saved-card" role="status">
                <div>
                  <span className="eyebrow">Draft saved successfully</span>
                  <strong>{recentDraft.invoiceNumber}</strong>
                  <p>
                    {recentDraft.items.length} line items · Total{" "}
                    {recentDraft.total}
                  </p>
                </div>
                <span className="role-badge">Draft</span>
              </section>
            )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {invoiceId ? (
            <InvoiceDetailPage
              key={`${invoiceId}-${editingInvoice}`}
              id={invoiceId}
              editing={editingInvoice}
              api={api}
              permissions={session.permissions}
              currency={session.organization.currency}
            />
          ) : creatingInvoice ? (
            can("invoices:create") ? (
              <InvoiceForm
                api={api}
                onCreated={() => router.push("/invoices")}
              />
            ) : (
              <section className="panel empty-state">
                <h3>Invoice creation is restricted</h3>
                <p>
                  Your role allows you to view invoices, but not create them.
                </p>
                <Link className="button secondary" href="/invoices">
                  Back to invoices
                </Link>
              </section>
            )
          ) : !allowed ? (
            <section className="panel empty-state">
              <span className="empty-symbol">◎</span>
              <h3>This area needs additional access</h3>
              <p>
                Your {roleLabel(session.role)} role doesn’t include team
                management. Ask your owner or administrator if you need access.
              </p>
            </section>
          ) : tab === "overview" ? (
            <OverviewPage session={session} navigate={navigate} />
          ) : tab === "profile" || tab === "password" ? (
            <>
              <CurrentSettingsPage
                key={tab}
                user={session.user}
                api={api}
                onProfileChange={onProfileChange}
                onSaved={recordNotification}
              />
              {tab === "profile" &&
                session.permissions.includes("organization:update") && (
                  <CompanyLogoSettings
                    organization={session.organization}
                    api={api}
                    onProfileChange={onProfileChange}
                    onSaved={recordNotification}
                  />
                )}
            </>
          ) : tab === "access" ? (
            <AccessPage
              session={session}
              refreshAccess={refreshAccess}
              refreshing={refreshing}
            />
          ) : loading ? (
            <section className="panel loading" role="status">
              <span className="spinner" />
              Loading {currentNav.label.toLowerCase()}…
            </section>
          ) : loadFailed ? (
            <section className="panel empty-state">
              <h3>We couldn’t load these records</h3>
              <p>Check the message above and try again.</p>
              <button
                type="button"
                className="button secondary"
                onClick={reload}
              >
                Try again
              </button>
            </section>
          ) : (
            <>
              {tab === "clients" && (
                <ClientsPage
                  key={`${revision}-${offset}`}
                  clients={rows as Client[]}
                  canCreate={can("clients:create")}
                  canUpdate={can("clients:update")}
                  api={api}
                  onSaved={saved}
                  onError={(failure) => setError(errorMessage(failure))}
                />
              )}
              {tab === "members" && (
                <TeamPage
                  members={rows as Member[]}
                  role={session.role}
                  api={api}
                  onSaved={saved}
                  onError={(failure) => setError(errorMessage(failure))}
                />
              )}
              {(tab === "invoices" ||
                tab === "expenses" ||
                tab === "retainers") && (
                <CurrentFinancialPage
                  key={`${tab}-${revision}-${offset}`}
                  rows={rows as FinancialRecord[]}
                  currency={session.organization.currency}
                  permissions={session.permissions}
                  onDeleted={() => {
                    reload();
                    router.push("/invoices");
                  }}
                  api={api}
                />
              )}
              <div className="pagination">
                <span>
                  {rows.length
                    ? `Showing ${offset + 1}–${offset + rows.length}`
                    : "No records on this page"}
                </span>
                <div>
                  <button
                    className="button secondary compact"
                    type="button"
                    disabled={offset === 0}
                    onClick={() => {
                      setOffset((value) => value - 20);
                      setLoading(true);
                      setError("");
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    className="button secondary compact"
                    type="button"
                    disabled={rows.length < 20}
                    onClick={() => {
                      setOffset((value) => value + 20);
                      setLoading(true);
                      setError("");
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
          <Footer />
        </div>
      </main>
    </WorkspaceLayout>
  );
}
