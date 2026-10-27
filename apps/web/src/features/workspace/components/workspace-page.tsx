"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
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
  type Client,
  type FinancialRecord,
  type Member,
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
    } catch {
      /* Local storage may be unavailable. */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const { notifications, toast, notify, dismissToast, clearNotifications } = useNotifications();
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    const applyTheme = () => {
      flushSync(() => setTheme(next));
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduceMotion) {
      applyTheme();
    } else {
      document.documentElement.classList.add("theme-view-transition");
      const transition = document.startViewTransition(applyTheme);
      const finishTransition = () => {
        document.documentElement.classList.remove("theme-view-transition");
      };
      void transition.finished.then(finishTransition, finishTransition);
    }
    try {
      localStorage.setItem("puffinpal-theme", next);
    } catch {
      /* Theme still applies for the current page. */
    }
  }
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
  const [previousTab, setPreviousTab] = useState(tab);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<(Client | Member | FinancialRecord)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
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
  useEffect(() => {
    if (
      invoiceId ||
      ["overview", "access", "profile", "password"].includes(tab) ||
      tab === "expenses" ||
      tab === "retainers" ||
      tab === "employees" ||
      tab === "workforce" ||
      tab === "attendance" ||
      tab === "leave" ||
      tab === "overtime" ||
      tab === "payroll" ||
      tab === "payroll-automation" ||
      tab === "cash-flow" ||
      tab === "banking" ||
      tab === "reports" ||
      tab === "vendors" ||
      tab === "accounts-payable" ||
      !allowed
    )
      return;
    const controller = new AbortController();
    api<(Client | Member | FinancialRecord)[]>(`/${tab}?limit=20&offset=${offset}`, {
      signal: controller.signal,
    })
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
