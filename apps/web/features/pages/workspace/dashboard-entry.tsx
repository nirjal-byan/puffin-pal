"use client";
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  apiRequest,
  ApiError,
  errorMessage,
  getActiveSession,
  getServerSession,
  refreshSession,
  setActiveSession,
  subscribeSession,
  type Profile,
} from "../../../lib/api";
import type { Tab } from "../../../lib/navigation";
import LoginPage from "../login/page";
import WorkspacePage from "./page";

function SessionEntry({
  initialTab,
  creatingInvoice = false,
  invoiceId,
  editingInvoice = false,
}: {
  initialTab?: Tab;
  creatingInvoice?: boolean;
  invoiceId?: string;
  editingInvoice?: boolean;
}) {
  const session = useSyncExternalStore(subscribeSession, getActiveSession, getServerSession);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const [slug, setSlug] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .catch((error: unknown) => {
        if (!cancelled && !(error instanceof ApiError && error.status === 401))
          setRestoreError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const onProfileChange = useCallback((profile: Profile) => {
    const current = getActiveSession();
    if (current?.user.id === profile.user.id) setActiveSession({ ...current, ...profile });
  }, []);
  const onSignOut = useCallback(async (expired = false) => {
    try {
      if (!expired) await apiRequest("/auth/logout", { method: "POST" });
      const current = getActiveSession();
      if (current) setSlug(current.organization.slug);
      setActiveSession(null);
      setNotice(expired ? "Your session expired. Sign in again to continue." : "");
    } catch (error) {
      setNotice(`Could not sign out. ${errorMessage(error)}`);
    }
  }, []);
  if (restoring)
    return (
      <main className="session-loading" role="status">
        <span className="spinner" /> Restoring your workspace…
      </main>
    );
  if (restoreError && !session)
    return (
      <main className="session-loading">
        <div>
          <p role="alert">{restoreError}</p>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setRestoring(true);
              refreshSession()
                .then(() => setRestoreError(""))
                .catch((error: unknown) => {
                  setRestoreError(
                    error instanceof ApiError && error.status === 401 ? "" : errorMessage(error),
                  );
                })
                .finally(() => setRestoring(false));
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  if (!session)
    return (
      <LoginPage
        initialSlug={slug}
        notice={notice}
        onAuthenticated={(next) => {
          setActiveSession(next);
          setSlug(next.organization.slug);
          setNotice("");
        }}
      />
    );
  return (
    <>
      {notice && (
        <p className="session-banner" role="alert">
          {notice}
        </p>
      )}
      <WorkspacePage
        key={`${session.user.id}-${invoiceId ?? "list"}-${editingInvoice}`}
        session={session}
        initialTab={initialTab}
        creatingInvoice={creatingInvoice}
        invoiceId={invoiceId}
        editingInvoice={editingInvoice}
        onProfileChange={onProfileChange}
        onSignOut={onSignOut}
      />
    </>
  );
}

export default function DashboardEntry(props: {
  initialTab?: Tab;
  creatingInvoice?: boolean;
  invoiceId?: string;
  editingInvoice?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <main className="session-loading" role="status">
          Loading your workspace…
        </main>
      }
    >
      <SessionEntry {...props} />
    </Suspense>
  );
}
