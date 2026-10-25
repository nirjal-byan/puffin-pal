"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { errorMessage, type Session, type WorkspaceApi } from "@/lib/api";
import {
  adjacentStep,
  initialTour,
  tourPosition,
  tourSteps,
  tourStorageKey,
  visibleTourTarget,
  type TourRect,
  type TourState,
} from "./tour";

const TARGET_WAIT_MS = 600;

export function ProductTour({ session, api }: { session: Session; api: WorkspaceApi }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const steps = useMemo(() => tourSteps(session.permissions), [session.permissions]);
  const [state, setState] = useState<TourState>(() => {
    let saved: unknown;
    try {
      saved = JSON.parse(sessionStorage.getItem(tourStorageKey(session.user.id)) ?? "null");
    } catch {
      // The tutorial remains usable when browser storage is unavailable.
    }
    const initial = initialTour(session.user, saved);
    return steps.some((step) => step.id === initial.step)
      ? initial
      : { ...initial, step: adjacentStep(steps, initial.step, 1) };
  });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [rect, setRect] = useState<TourRect | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 340 });
  const panel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const step = steps.find((item) => item.id === state.step) ?? steps[0];
  const index = Math.max(
    0,
    steps.findIndex((item) => item.id === step?.id),
  );
  const currentRoute = pathname + (search.toString() ? `?${search}` : "");
  const onRoute = !step?.route || currentRoute === step.route;

  const saveLocal = useCallback(
    (next: TourState) => {
      try {
        sessionStorage.setItem(tourStorageKey(session.user.id), JSON.stringify(next));
      } catch {
        // Server progress still preserves first-time onboarding.
      }
    },
    [session.user.id],
  );

  const change = useCallback(
    async (next: TourState, status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED" = "IN_PROGRESS") => {
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
        if (!next.active) {
          document.querySelector<HTMLButtonElement>('[data-tour="tutorial"]')?.focus();
        }
      } catch (error) {
        setFailure(errorMessage(error));
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [api, saveLocal, state.manual],
  );

  const move = useCallback(
    (direction: 1 | -1) => {
      if (!step) return;
      void change({ ...state, direction, step: adjacentStep(steps, step.id, direction) });
    },
    [change, state, step, steps],
  );

  const finish = useCallback(
    (status: "COMPLETED" | "SKIPPED" = "COMPLETED") => {
      void change({ ...state, active: false }, status);
    },
    [change, state],
  );

  useEffect(() => {
    const restart = () => {
      const next: TourState = { active: true, manual: true, step: steps[0]?.id ?? "welcome" };
      saveLocal(next);
      setFailure("");
      setState(next);
    };
    window.addEventListener("puffinpal:start-tour", restart);
    return () => window.removeEventListener("puffinpal:start-tour", restart);
  }, [saveLocal, steps]);

  useEffect(() => {
    if (state.active && step?.route && !onRoute) router.push(step.route);
  }, [onRoute, router, state.active, step?.route]);

  useEffect(() => {
    if (!state.active || !onRoute || !step) return;
    const started = performance.now();
    let frame = 0;
    const update = () => {
      const primary = step.target
        ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
        : null;
      const fallback = step.target
        ? document.querySelector<HTMLElement>('[data-tour="page-heading"]')
        : null;
      const elapsed = performance.now() - started;
      const target = visibleTourTarget(primary)
        ? primary
        : elapsed >= TARGET_WAIT_MS && visibleTourTarget(fallback)
          ? fallback
          : null;
      const bounds = target?.getBoundingClientRect();
      const nextRect = bounds
        ? {
            left: bounds.left - 5,
            top: bounds.top - 5,
            width: bounds.width + 10,
            height: bounds.height + 10,
          }
        : null;
      setRect(nextRect);
      setPosition(
        tourPosition(
          nextRect,
          { width: innerWidth, height: innerHeight },
          { width: 340, height: panel.current?.offsetHeight ?? 245 },
        ),
      );
      if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
      else if (elapsed < TARGET_WAIT_MS) frame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    addEventListener("scroll", update, true);
    addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      removeEventListener("scroll", update, true);
      removeEventListener("resize", update);
    };
  }, [onRoute, state.active, step]);

  useEffect(() => {
    if (!state.active) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish("SKIPPED");
      if (event.key === "ArrowRight" && index < steps.length - 1) move(1);
      if (event.key === "ArrowLeft" && index > 0) move(-1);
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [finish, index, move, state.active, steps.length]);

  if (!state.active || !step) return null;

  return (
    <div className="tour-layer">
      {onRoute && rect ? (
        <div className="tour-spotlight" style={rect} />
      ) : (
        <div className="tour-dim" />
      )}
      <div
        ref={panel}
        className="tour-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
        style={position}
      >
        <button
          className="tour-close"
          type="button"
          disabled={busy}
          aria-label="Exit tutorial"
          onClick={() => finish("SKIPPED")}
        >
          ×
        </button>
        <div className="tour-progress">
          Step {index + 1} of {steps.length}
        </div>
        <div className="tour-progress-track" aria-hidden="true">
          <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-description">{step.description}</p>
        {failure && (
          <p className="alert" role="alert">
            {failure}
          </p>
        )}
        <div className="tour-controls tour-controls-end">
          <div>
            {index > 0 && (
              <button className="button secondary" disabled={busy} onClick={() => move(-1)}>
                Back
              </button>
            )}
            {index < steps.length - 1 ? (
              <button className="button primary" disabled={busy} onClick={() => move(1)}>
                {index === 0 ? "Start" : "Next"}
              </button>
            ) : (
              <button className="button primary" disabled={busy} onClick={() => finish()}>
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
