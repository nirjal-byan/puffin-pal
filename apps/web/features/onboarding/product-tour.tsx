"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { errorMessage, type Session, type WorkspaceApi } from "../../lib/api";
import {
  adjacentStep, initialTour, tourPosition, tourSteps, tourStorageKey,
  visibleTourTarget, type TourRect, type TourState,
} from "./tour";

export function ProductTour({ session, api }: { session: Session; api: WorkspaceApi }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<TourState>(() => {
    let saved: unknown;
    try { saved = JSON.parse(sessionStorage.getItem(tourStorageKey(session.user.id)) ?? "null"); }
    catch { /* Storage may be disabled; database progress still works. */ }
    return initialTour(session.user, saved);
  });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [rect, setRect] = useState<TourRect | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 360 });
  const [measuredStep, setMeasuredStep] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const steps = useMemo(() => tourSteps(session.permissions), [session.permissions]);
  const index = steps.findIndex((step) => step.id === state.step);
  const step = steps[index < 0 ? 0 : index]!;
  const target = step.target;
  const route = step.route;
  const currentRoute = pathname + (search.toString() ? `?${search}` : "");
  const onRoute = !route || currentRoute === route;
  const ready = measuredStep === state.step && onRoute;
  const saveLocal = useCallback((next: TourState) => {
    try { sessionStorage.setItem(tourStorageKey(session.user.id), JSON.stringify(next)); }
    catch { /* Continue without tab-local storage. */ }
  }, [session.user.id]);
  const change = useCallback(async (next: TourState, status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED" = "IN_PROGRESS") => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure("");
    try {
      if (!state.manual) {
        await api("/auth/me/onboarding", { method: "PATCH", body: { status, step: next.step } });
      }
      saveLocal(next);
      setState(next);
      if (!next.active) document.querySelector<HTMLButtonElement>('[data-tour="tutorial"]')?.focus();
    } catch (error) { setFailure(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }, [api, saveLocal, state.manual]);
  const move = useCallback((direction: 1 | -1) => {
    void change({ ...state, step: adjacentStep(tourSteps(session.permissions), state.step, direction) });
  }, [change, session.permissions, state]);
  const skip = useCallback(() => {
    void change({ ...state, active: false }, "SKIPPED");
  }, [change, state]);
  useEffect(() => {
    const restart = () => {
      if (pending.current) return;
      const next = { active: true, manual: true, step: "welcome" };
      saveLocal(next);
      setFailure("");
      setState(next);
    };
    window.addEventListener("puffinpal:start-tour", restart);
    return () => window.removeEventListener("puffinpal:start-tour", restart);
  }, [saveLocal]);
  useEffect(() => {
    if (!state.active) return;
    // Store the active step before routing, so remounts resume the same tour.
    saveLocal(state);
    if (index < 0) {
      const timer = setTimeout(() => {
        const next = { ...state, step: adjacentStep(steps, state.step, 1) };
        saveLocal(next);
        setState(next);
      }, 0);
      return () => clearTimeout(timer);
    }
    if (!onRoute && route) router.push(route);
  }, [state, index, onRoute, route, router, saveLocal, steps]);
  useEffect(() => {
    if (!state.active || !onRoute) return;
    let scrolled: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let frame = 0;
    const update = () => {
      const element = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
      if (target && !visibleTourTarget(element)) {
        setMeasuredStep("");
        clearTimeout(timer);
        timer = setTimeout(() => {
          const next = { ...state, step: adjacentStep(tourSteps(session.permissions), state.step, 1) };
          saveLocal(next);
          setState(next);
        }, 1000);
        return;
      }
      clearTimeout(timer);
      if (element && scrolled !== element) {
        scrolled = element;
        element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center", inline: "center" });
      }
      const bounds = element?.getBoundingClientRect();
      const next = bounds ? { left: bounds.left - 5, top: bounds.top - 5, width: bounds.width + 10, height: bounds.height + 10 } : null;
      setRect(next);
      setPosition(tourPosition(next, { width: window.innerWidth, height: window.innerHeight }, {
        width: 360, height: panel.current?.offsetHeight ?? 280,
      }));
      setMeasuredStep(state.step);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    const observer = new MutationObserver(schedule);
    observer.observe(document.querySelector(".workspace-main") ?? document.body, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    if (panel.current) resize.observe(panel.current);
    if (scrolled) resize.observe(scrolled);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      clearTimeout(timer); cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [state, target, onRoute, session.permissions, saveLocal]);
  useEffect(() => {
    if (!state.active || !ready || !onRoute) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); skip(); }
      if (event.key !== "Tab") return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) { event.preventDefault(); return; }
      const first = buttons[0]!;
      const last = buttons[buttons.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [state.active, ready, onRoute, state.step, skip]);
  if (!state.active || !onRoute) return null;
  return (
    <div className="tour-layer" style={{ visibility: ready ? "visible" : "hidden" }}>
      {rect ? <div className="tour-spotlight" style={rect} /> : <div className="tour-dim" />}
      <div ref={panel} className="tour-panel" role="dialog" aria-modal="true"
        aria-labelledby="tour-title" aria-describedby="tour-description" tabIndex={-1} style={position}>
        <div className="tour-progress" aria-live="polite">Step {index + 1} of {steps.length}</div>
        <div className="tour-progress-track" aria-hidden="true"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-description">{step.description}</p>
        {failure && <p className="alert" role="alert">{failure} Please try again.</p>}
        <div className="tour-controls">
          <button className="text-button" type="button" disabled={busy} onClick={skip}>Skip</button>
          <div>
            {index > 0 && <button className="button secondary" type="button" disabled={busy} onClick={() => move(-1)}>Back</button>}
            <button className="button primary" type="button" disabled={busy} aria-busy={busy}
              onClick={() => index === steps.length - 1 ? void change({ ...state, active: false }, "COMPLETED") : move(1)}>
              {busy ? "Saving…" : index === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
