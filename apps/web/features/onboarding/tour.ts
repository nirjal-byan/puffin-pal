import type { Permission } from "@puffinpal/permissions";
import type { User } from "../../lib/api";

export const TOUR_STEPS = [
  { id: "welcome", title: "Welcome to PuffinPal", description: "Let’s take a quick look around your workspace. You can skip or replay this tour anytime." },
  { id: "dashboard", route: "/", target: "page-heading", title: "Your workspace at a glance", description: "Start here for an overview of your organization and quick access to your work." },
  { id: "clients", route: "/?section=clients&area=workspace", target: "nav-clients", permission: "clients:read", title: "Keep your clients together", description: "Manage client names and billing details here, ready for your invoices." },
  { id: "invoices", route: "/invoices", target: "nav-invoices", permission: "invoices:read", title: "Manage your invoices", description: "Find invoice records, open their details, and edit drafts when your role allows it." },
  { id: "create-invoice", route: "/invoices", target: "create-invoice", permission: "invoices:create", title: "Start with a draft", description: "Create Invoice opens the form for your client, dates and line items. Nothing is created during this tour." },
  { id: "issuance", route: "/invoices", target: "page-heading", permission: "invoices:read", title: "Finalize, then download", description: "Owners and admins can issue a draft from its detail page. Issuance locks billing details and amounts; issued invoices can be downloaded as PDFs." },
  { id: "team", route: "/?section=members", target: "nav-members", permission: "members:manage", title: "Invite your team", description: "Add teammates and choose their roles to give them the access they need." },
  { id: "settings", route: "/?section=profile", target: "page-heading", title: "Make yourself at home", description: "Update your profile here. Owners and admins can also manage the company logo in Settings." },
  { id: "finish", title: "You’re ready to go", description: "Start with a client or explore your invoices. Use Tutorial in the top bar whenever you need another look." },
] satisfies readonly { id: string; title: string; description: string; route?: string; target?: string; permission?: Permission }[];

export interface TourState { active: boolean; manual: boolean; step: string }
export const tourStorageKey = (userId: string) => `puffinpal-tour-v1:${userId}`;
export function tourSteps(permissions: readonly Permission[]) {
  return TOUR_STEPS.filter((step) => !step.permission || permissions.includes(step.permission));
}
export function initialTour(user: User, saved: unknown): TourState {
  if (saved && typeof saved === "object" && "step" in saved &&
      TOUR_STEPS.some((step) => step.id === saved.step) &&
      "active" in saved && typeof saved.active === "boolean" &&
      "manual" in saved && typeof saved.manual === "boolean") {
    const state = saved as TourState;
    if (state.manual || !state.active || ["PENDING", "IN_PROGRESS"].includes(user.onboardingStatus ?? "")) return state;
  }
  return {
    active: user.onboardingStatus === "PENDING" || user.onboardingStatus === "IN_PROGRESS",
    manual: false,
    step: user.onboardingStatus === "IN_PROGRESS" && TOUR_STEPS.some((step) => step.id === user.onboardingStep)
      ? user.onboardingStep! : "welcome",
  };
}
export function adjacentStep(steps: readonly { id: string }[], current: string, direction: 1 | -1) {
  const index = steps.findIndex((step) => step.id === current);
  if (index < 0) {
    const original = TOUR_STEPS.findIndex((step) => step.id === current);
    const candidates = direction === 1 ? steps : [...steps].reverse();
    return candidates.find((step) => (TOUR_STEPS.findIndex((item) => item.id === step.id) - original) * direction > 0)?.id
      ?? (direction === 1 ? steps[steps.length - 1]! : steps[0]!).id;
  }
  return steps[Math.max(0, Math.min(steps.length - 1, index + direction))]!.id;
}
export interface TourRect { left: number; top: number; width: number; height: number }
export function visibleTourTarget(element: HTMLElement | null): element is HTMLElement {
  if (!element || element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
export function tourPosition(target: TourRect | null, viewport: { width: number; height: number }, panel: { width: number; height: number }) {
  const gap = 16;
  const width = Math.min(panel.width, viewport.width - 24);
  const height = Math.min(panel.height, viewport.height - 24);
  let left = (viewport.width - width) / 2;
  let top = (viewport.height - height) / 2;
  if (target) {
    if (viewport.width - (target.left + target.width) >= width + gap) {
      left = target.left + target.width + gap; top = target.top;
    } else if (target.left >= width + gap) {
      left = target.left - width - gap; top = target.top;
    } else if (viewport.height - (target.top + target.height) >= height + gap) {
      left = target.left; top = target.top + target.height + gap;
    } else {
      left = target.left; top = target.top - height - gap;
    }
  }
  return { left: Math.max(12, Math.min(left, viewport.width - width - 12)), top: Math.max(12, Math.min(top, viewport.height - height - 12)), width };
}
