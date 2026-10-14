"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { errorMessage, type Session, type WorkspaceApi } from "../../lib/api";
import { initialTour, tourPosition, tourStorageKey, visibleTourTarget, type TourRect, type TourState } from "./tour";

type InteractiveStep = "welcome" | "dashboard" | "clients" | "invoices" | "create-invoice" |
  "issuance" | "payment-basics" | "team" | "settings" | "finish";
type InteractiveState = TourState & { clientId?: string; invoiceRoute?: string; invoiceId?: string; invoiceVersion?: number };
const STEPS: readonly { id: InteractiveStep; route?: (state: InteractiveState) => string; target?: string; title: string; text: string; event?: string }[] = [
  { id: "welcome", title: "Create a test invoice", text: "Add a client, save a draft, and explore PuffinPal." },
  { id: "dashboard", route: () => "/", target: "page-heading", title: "Workspace overview", text: "See your organization and recent activity here." },
  { id: "clients", route: () => "/?section=clients&area=workspace", target: "client-form", title: "Add a client", text: "Fill the form, then click Add client.", event: "puffinpal:tutorial-client-created" },
  { id: "invoices", route: () => "/invoices", target: "nav-invoices", title: "Your invoices", text: "Track drafts, balances, and payment status here." },
  { id: "create-invoice", route: (state) => `/invoices/new${state.clientId ? `?tutorialClient=${encodeURIComponent(state.clientId)}` : ""}`, target: "invoice-create-form", title: "Create an invoice", text: "Fill the form, then click Save as Draft.", event: "puffinpal:tutorial-invoice-created" },
  { id: "issuance", route: (state) => state.invoiceRoute ?? "/invoices", target: "issue-invoice", title: "Issue invoices", text: "Issuing locks the invoice. Keep this test as a draft for now." },
  { id: "payment-basics", route: (state) => state.invoiceRoute ?? "/invoices", target: "issue-invoice", title: "Payments and PDFs", text: "Issued invoices can be downloaded and marked as paid." },
  { id: "team", route: () => "/?section=members", target: "nav-members", title: "Manage your team", text: "Invite teammates and assign their roles here." },
  { id: "settings", route: () => "/?section=profile", target: "page-heading", title: "Profile and branding", text: "Update your profile and company logo here." },
  { id: "finish", route: (state) => state.invoiceRoute ?? "/invoices", target: "delete-draft", title: "Keep or delete?", text: "Choose what to do with your test draft." },
];

const SUGGESTIONS: Record<string, string> = {
  name: "PuffinPal Demo Client", email: "demo.client@example.com",
  companyName: "Northstar Demo Co.", taxId: "DEMO-TAX-001",
  description: "Website design", quantity: "1", unitPrice: "500.00",
};

function setSuggestedValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function ProductTour({ session, api }: { session: Session; api: WorkspaceApi }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<InteractiveState>(() => {
    let saved: unknown;
    try { saved = JSON.parse(sessionStorage.getItem(tourStorageKey(session.user.id)) ?? "null"); } catch { /* Storage may be disabled. */ }
    const initial = initialTour(session.user, saved) as InteractiveState;
    return { ...initial, step: STEPS.some((step) => step.id === initial.step) ? initial.step : "welcome" };
  });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [rect, setRect] = useState<TourRect | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 340 });
  const panel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const index = Math.max(0, STEPS.findIndex((step) => step.id === state.step));
  const step = STEPS[index]!;
  const currentRoute = pathname + (search.toString() ? `?${search}` : "");
  const route = step.route?.(state);
  const onRoute = !route || currentRoute === route;
  const saveLocal = useCallback((next: InteractiveState) => {
    try { sessionStorage.setItem(tourStorageKey(session.user.id), JSON.stringify(next)); } catch { /* Continue without tab storage. */ }
  }, [session.user.id]);
  const change = useCallback(async (next: InteractiveState, status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED" = "IN_PROGRESS") => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailure("");
    try {
      if (!state.manual) await api("/auth/me/onboarding", { method: "PATCH", body: { status, step: next.step } });
      saveLocal(next); setState(next);
      if (!next.active) document.querySelector<HTMLButtonElement>('[data-tour="tutorial"]')?.focus();
    } catch (error) { setFailure(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }, [api, saveLocal, state.manual]);
  const advance = useCallback((patch: Partial<InteractiveState> = {}) => {
    const next = STEPS[index + 1];
    if (next) void change({ ...state, ...patch, step: next.id });
  }, [change, index, state]);
  const back = useCallback(() => {
    const previous = STEPS[index - 1];
    if (previous) void change({ ...state, step: previous.id });
  }, [change, index, state]);
  const finish = useCallback((status: "COMPLETED" | "SKIPPED" = "COMPLETED") => {
    void change({ ...state, active: false }, status);
  }, [change, state]);

  useEffect(() => {
    const restart = () => {
      const next: InteractiveState = { active: true, manual: true, step: "welcome" };
      saveLocal(next); setFailure(""); setState(next);
    };
    window.addEventListener("puffinpal:start-tour", restart);
    return () => window.removeEventListener("puffinpal:start-tour", restart);
  }, [saveLocal]);
  useEffect(() => {
    if (state.active && route && !onRoute) router.push(route);
  }, [onRoute, route, router, state.active]);
  useEffect(() => {
    if (!state.active || !step.event) return;
    const completed = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; version?: number }>).detail;
      if (step.id === "clients") advance({ clientId: detail.id });
      else if (step.id === "create-invoice") advance({ invoiceRoute: `/invoices/${detail.id}`, invoiceId: detail.id, invoiceVersion: detail.version });
    };
    window.addEventListener(step.event, completed);
    return () => window.removeEventListener(step.event!, completed);
  }, [advance, state.active, step.event, step.id]);
  useEffect(() => {
    if (!state.active || state.step !== "finish") return;
    const deleted = () => finish();
    window.addEventListener("puffinpal:tutorial-invoice-deleted", deleted);
    return () => window.removeEventListener("puffinpal:tutorial-invoice-deleted", deleted);
  }, [finish, state.active, state.step]);
  const deleteDraft = useCallback(async () => {
    if (!state.invoiceId || state.invoiceVersion === undefined || pending.current) return;
    pending.current = true; setBusy(true); setFailure("");
    try {
      await api(`/invoices/${state.invoiceId}`, { method: "DELETE", body: { expectedVersion: state.invoiceVersion } });
      const next = { ...state, active: false };
      saveLocal(next); setState(next); router.push("/invoices");
      if (!state.manual) {
        try { await api("/auth/me/onboarding", { method: "PATCH", body: { status: "COMPLETED", step: "finish" } }); }
        catch { /* Draft deletion succeeded, so do not ask the user to delete it again. */ }
      }
    } catch (error) { setFailure(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }, [api, router, saveLocal, state]);
  useEffect(() => {
    if (!state.active || !onRoute) return;
    const update = () => {
      const element = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      const target = visibleTourTarget(element) ? element : null;
      const bounds = target?.getBoundingClientRect();
      const nextRect = bounds ? { left: bounds.left - 5, top: bounds.top - 5, width: bounds.width + 10, height: bounds.height + 10 } : null;
      setRect(nextRect);
      setPosition(tourPosition(nextRect, { width: innerWidth, height: innerHeight }, { width: 340, height: panel.current?.offsetHeight ?? 245 }));
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.querySelector(".workspace-main") ?? document.body, { subtree: true, childList: true });
    addEventListener("resize", update);
    return () => { observer.disconnect(); removeEventListener("resize", update); };
  }, [onRoute, state.active, step.target]);
  useEffect(() => {
    if (!state.active || !["clients", "create-invoice"].includes(state.step)) return;
    const suggest = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.shiftKey) return;
      const input = event.target as HTMLInputElement;
      const suggestion = input.dataset.tourSuggestion ?? SUGGESTIONS[input.name];
      if (input instanceof HTMLInputElement && !input.value && suggestion) {
        event.preventDefault(); setSuggestedValue(input, suggestion);
      }
    };
    document.addEventListener("keydown", suggest, true);
    return () => document.removeEventListener("keydown", suggest, true);
  }, [state.active, state.step]);
  if (!state.active) return null;

  return <div className="tour-layer tour-layer-interactive">
    {rect ? <div className="tour-spotlight" style={rect} /> : <div className="tour-dim" />}
    <div ref={panel} className="tour-panel" role="dialog" aria-labelledby="tour-title" aria-describedby="tour-description" style={position}>
      <button className="tour-close" type="button" disabled={busy} aria-label="Exit tutorial" title="Exit tutorial" onClick={() => finish("SKIPPED")}>×</button>
      <div className="tour-progress">Step {index + 1} of {STEPS.length}</div>
      <div className="tour-progress-track"><span style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} /></div>
      <h2 id="tour-title">{step.title}</h2><p id="tour-description">{step.text}</p>
      {step.id === "clients" && <p className="tour-suggested-data"><strong>Suggested:</strong> PuffinPal Demo Client · demo.client@example.com · Northstar Demo Co.</p>}
      {step.id === "create-invoice" && <p className="tour-suggested-data"><strong>Suggested:</strong> Website design · quantity 1 · unit price 500.00</p>}
      {["clients", "create-invoice"].includes(step.id) && <p className="tour-tab-hint"><kbd>Tab</kbd> fills the suggested value.</p>}
      {failure && <p className="alert" role="alert">{failure}</p>}
      <div className="tour-controls tour-controls-end"><div>
        {index > 0 && <button className="button secondary" disabled={busy} onClick={back}>Back</button>}
        {step.id === "welcome" && <button className="button primary" disabled={busy} onClick={() => advance()}>Start</button>}
        {!step.event && !["welcome", "finish"].includes(step.id) && <button className="button primary" disabled={busy} onClick={() => advance()}>Continue</button>}
        {step.id === "finish" && <><button className="button secondary" disabled={busy} onClick={() => finish()}>Keep draft</button><button className="button danger" disabled={busy || !state.invoiceId} onClick={() => void deleteDraft()}>{busy ? "Deleting…" : "Delete draft"}</button></>}
        {step.event && <span className="muted">Complete the highlighted action</span>}
      </div></div>
    </div>
  </div>;
}
