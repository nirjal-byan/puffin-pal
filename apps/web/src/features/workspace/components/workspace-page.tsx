"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { InvoiceDetailPage } from "@/features/invoices/components/invoice-detail-page";
import { ProductTour } from "@/features/onboarding/product-tour";
import { recentlyCreatedInvoice } from "@/features/invoices/api/invoices";
import type { Permission } from "@puffinpal/permissions";
import {
  ApiError,
  apiRequest,
  errorMessage,
  roleLabel,
  type Profile,
  type Session,
} from "@/lib/api";
import type { WorkspaceApi } from "@/lib/api";
import { NAV, sectionForTab, resolveTab, tabHref, type Tab } from "@/lib/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Footer } from "@/components/layout/footer";
import { DocumentTitle } from "@/components/layout/document-title";
import { Snackbar } from "@/components/ui/snackbar";
import { useNotifications } from "@/providers/notification-provider";
import WorkspaceLayout from "./workspace-layout";
import { WorkspaceContent } from "./workspace-content";
import { WorkspaceInvoiceModals } from "./workspace-invoice-modals";
import { WorkspacePageHeader } from "./workspace-page-header";
import { useWorkspaceRecords } from "../hooks/use-workspace-records";
import { useWorkspaceTheme } from "../hooks/use-workspace-theme";

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
  const { theme, toggleTheme } = useWorkspaceTheme();
  const { notifications, toast, notify, dismissToast, clearNotifications } = useNotifications();
  function recordNotification(message: string) {
    notify(message);
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
        : (NAV.find((item) => item.key === tab)?.label ?? "Workspace");
  const [refreshing, setRefreshing] = useState(false);
  const can = (permission: Permission) => session.permissions.includes(permission);
  const currentNav = NAV.find((item) => item.key === tab)!;
  const allowed = can(currentNav.permission);
  const api: WorkspaceApi = useCallback(
    async <T,>(
      path: string,
      options?: {
        method?: string;
        body?: unknown;
        signal?: AbortSignal;
        responseType?: "blob" | "file";
      },
    ) => {
      try {
        return await apiRequest<T>(path, {
          ...options,
          token: session.accessToken,
        });
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) onSignOut(true);
        throw failure;
      }
    },
    [session.accessToken, onSignOut],
  );
  const { rows, loading, error, setError, loadFailed, revision, offset, reload, previous, next } =
    useWorkspaceRecords({ api, tab, allowed, invoiceId, creatingInvoice });
  function navigate(next: Tab) {
    router.push(tabHref(next));
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
      recordNotification("Your access is up to date.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setRefreshing(false);
    }
  }
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
        onClearNotifications={clearNotifications}
      />
      <Sidebar session={session} tab={tab} area={activeSection.key} onSignOut={() => onSignOut()} />
      <main className="workspace-main">
        <header className="topbar">
          <span>
            {activeSection.label} <span className="breadcrumb">/</span>{" "}
            {invoiceId ? "Invoice Details" : currentNav.label}
          </span>
        </header>
        <div key={`${tab}-${creatingInvoice}`} className="workspace-content page-transition">
          <WorkspacePageHeader
            tab={tab}
            invoiceId={invoiceId}
            creatingInvoice={creatingInvoice}
            title={currentNav.label}
            organizationName={session.organization.name}
            permissions={session.permissions}
            allowed={allowed}
            loading={loading}
            onReload={reload}
          />
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
          {!creatingInvoice && !invoiceId && tab === "invoices" && recentDraft && (
            <section className="panel invoice-saved-card" role="status">
              <div>
                <span className="eyebrow">Draft saved successfully</span>
                <strong>{recentDraft.invoiceNumber}</strong>
                <p>
                  {recentDraft.items.length} line items · Total {recentDraft.total}
                </p>
              </div>
              <span className="role-badge">Draft</span>
            </section>
          )}
          {toast && <Snackbar key={toast.id} message={toast.message} onDismiss={dismissToast} />}
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
                Your {roleLabel(session.role)} role doesn’t include team management. Ask your owner
                or administrator if you need access.
              </p>
            </section>
          ) : (
            <>
              <WorkspaceContent
                session={session}
                tab={tab}
                currentLabel={currentNav.label}
                api={api}
                rows={rows}
                loading={loading}
                loadFailed={loadFailed}
                revision={revision}
                offset={offset}
                refreshing={refreshing}
                navigate={navigate}
                reload={reload}
                saved={saved}
                notify={recordNotification}
                refreshAccess={() => void refreshAccess()}
                onProfileChange={onProfileChange}
                onError={(failure) => setError(errorMessage(failure))}
                onInvoicesDeleted={() => {
                  reload();
                  router.push("/invoices");
                }}
              />
              {![
                "overview",
                "profile",
                "password",
                "access",
                "expenses",
                "retainers",
                "employees",
                "workforce",
                "payroll",
                "payroll-automation",
                "attendance",
                "leave",
                "overtime",
                "cash-flow",
                "banking",
                "reports",
                "vendors",
                "accounts-payable",
              ].includes(tab) && (
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
                      onClick={previous}
                    >
                      ← Previous
                    </button>
                    <button
                      className="button secondary compact"
                      type="button"
                      disabled={rows.length < 20}
                      onClick={next}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <WorkspaceInvoiceModals
            creating={creatingInvoice}
            editing={editingInvoice}
            invoiceId={invoiceId}
            tutorialClient={searchParams.has("tutorialClient")}
            api={api}
            permissions={session.permissions}
            currency={session.organization.currency}
            onNavigate={(href) => router.push(href)}
          />
          <Footer />
        </div>
      </main>
    </WorkspaceLayout>
  );
}
