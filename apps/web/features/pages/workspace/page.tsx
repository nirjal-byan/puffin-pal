"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { InvoiceDetailPage } from "../../invoices/components/invoice-detail-page";
import { InvoiceForm } from "../../invoices/components/invoice-form";
import { ProductTour } from "../../onboarding/product-tour";
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
import { AppModal } from "../../../components/app-modal";
import { DocumentTitle } from "../../../components/document-title";
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
    } catch { /* Local storage may be unavailable. */ }
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
    } catch { /* Theme still applies for the current page. */ }
  }
  function recordNotification(message: string) {
    setNotice(message);
    setNotifications((items) => [message, ...items].slice(0, 20));
  }
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = resolveTab(pathname, searchParams.get("section"), initialTab);
  const activeSection = sectionForTab(tab, searchParams.get("area"));
  const pageTitle = creatingInvoice
    ? "Create invoice"
    : invoiceId
      ? editingInvoice
        ? "Edit invoice"
        : "Invoice details"
      : tab === "overview"
        ? "Financial overview"
        : NAV.find((item) => item.key === tab)?.label ?? "Workspace";
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
      options?: { method?: string; body?: unknown; signal?: AbortSignal; responseType?: "blob" | "file" },
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
      invoiceId ||
      ["overview", "access", "profile", "password"].includes(tab) ||
      tab === "expenses" || tab === "retainers" ||
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
  return (
    <WorkspaceLayout theme={theme}>
      <DocumentTitle title={pageTitle} />
      <ProductTour key={session.user.id} session={session} api={api} />
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
              ? "Invoice Details"
              : currentNav.label}
          </span>
        </header>
        <div
          key={`${tab}-${creatingInvoice}`}
          className="workspace-content page-transition"
        >
          {tab !== "overview" && <div className="page-heading" data-tour="page-heading">
            <div>
              <span className="eyebrow">{session.organization.name}</span>
              <h1>
                {invoiceId
                  ? "Invoice Details"
                  : currentNav.label === "My access"
                      ? "Your workspace access"
                      : currentNav.label}
              </h1>
              <p className="muted">
                {DESCRIPTION[tab]}
              </p>
            </div>
            <div className="page-heading-actions">
              {!creatingInvoice &&
                !invoiceId &&
                tab === "invoices" &&
                can("invoices:create") && (
                  <Link className="button primary" href="/invoices/new" data-tour="create-invoice">
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
          </div>}
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
              editing={false}
              api={api}
              permissions={session.permissions}
              currency={session.organization.currency}
            />
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
            <OverviewPage session={session} navigate={navigate} api={api} />
          ) : tab === "profile" || tab === "password" ? (
            <div className={tab === "profile" && can("organization:update") ? "profile-settings-columns" : undefined}>
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
            </div>
          ) : tab === "access" ? (
            <AccessPage
              session={session}
              refreshAccess={refreshAccess}
              refreshing={refreshing}
            />
          ) : tab === "expenses" ? (
            <ExpensesPage
              api={api}
              currency={session.organization.currency}
              permissions={session.permissions}
              onSaved={recordNotification}
              onError={(failure) => setError(errorMessage(failure))}
            />
          ) : tab === "retainers" ? (
            <RetainersPage api={api} currency={session.organization.currency} permissions={session.permissions} onSaved={recordNotification} />
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
                  canDelete={can("clients:delete")}
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
              {tab === "invoices" && (
                <InvoicesPage
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
          {creatingInvoice && can("invoices:create") && (
            <AppModal title="Create invoice" badge="Draft" wide onClose={() => router.push("/invoices")}>
              <InvoiceForm
                api={api}
                modalActions
                onCreated={(invoice) => router.push(searchParams.has("tutorialClient") ? `/invoices/${invoice.id}` : "/invoices")}
              />
            </AppModal>
          )}
          {editingInvoice && invoiceId && (
            <AppModal title="Edit draft invoice" badge="Draft" wide onClose={() => router.push(`/invoices/${invoiceId}`)}>
              <InvoiceDetailPage
                id={invoiceId}
                editing
                modal
                api={api}
                permissions={session.permissions}
                currency={session.organization.currency}
              />
            </AppModal>
          )}
          <Footer />
        </div>
      </main>
    </WorkspaceLayout>
  );
}
