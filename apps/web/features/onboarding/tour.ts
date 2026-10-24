import type { Permission } from "@puffinpal/permissions";
import type { User } from "../../lib/api";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  route?: string;
  target?: string;
  requiredPermissions?: readonly Permission[];
  detail?: boolean;
}

export const TOUR_STEPS: readonly TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to PuffinPal",
    description:
      "Let’s take a quick look around your workspace. You can skip or replay this tour anytime.",
  },
  {
    id: "overview",
    route: "/",
    target: "dashboard-summary",
    title: "See the business at a glance",
    description:
      "Review revenue, collections, expenses, outstanding invoices, and financial trends from your overview.",
  },
  {
    id: "billing",
    route: "/invoices",
    target: "page-heading",
    requiredPermissions: ["invoices:read"],
    title: "Manage clients and billing",
    description:
      "Create clients, prepare and issue invoices, record payments, export PDFs, and schedule recurring retainers from the Workspace section.",
  },
  {
    id: "spending",
    route: "/?section=expenses&area=workspace",
    target: "page-heading",
    requiredPermissions: ["expenses:read"],
    title: "Control business spending",
    description:
      "Record expenses, attach private receipts, submit them for approval, and review their history here.",
  },
  {
    id: "cash-flow",
    route: "/?section=cash-flow",
    target: "cash-flow-overview",
    requiredPermissions: ["cash-flow:read"],
    title: "Plan future cash flow",
    description:
      "Compare deterministic cash scenarios from invoices, payroll, recurring billing, and enabled planning assumptions.",
  },
  {
    id: "people",
    route: "/?section=employees",
    target: "page-heading",
    requiredPermissions: ["employees:read"],
    title: "Manage people and workforce",
    description:
      "The People section covers employees, salary history, schedules, attendance, leave, overtime, holidays, and team access.",
  },
  {
    id: "payroll",
    route: "/?section=payroll",
    target: "payroll-overview",
    requiredPermissions: ["payroll:read"],
    title: "Run payroll",
    description:
      "Create pay runs, review workforce inputs and statutory deductions, approve payroll, record payments, and download payslips.",
  },
  {
    id: "payroll-automation",
    route: "/?section=payroll-automation",
    target: "page-heading",
    requiredPermissions: ["payroll:read"],
    title: "Automate payroll preparation",
    description:
      "Schedule payroll drafts, review reminders, and configure versioned tax and statutory calculation rules on the Automation page.",
  },
  {
    id: "finish",
    title: "You’re ready to go",
    description:
      "Choose any section to begin. Use Tutorial in the top bar whenever you want this quick overview again.",
  },
];

export interface TourState {
  active: boolean;
  manual: boolean;
  step: string;
  direction?: 1 | -1;
}
const LEGACY_STEP_ALIASES: Readonly<Record<string, string>> = {
  dashboard: "overview",
  "dashboard-charts": "overview",
  clients: "billing",
  invoices: "billing",
  "create-invoice": "billing",
  issuance: "billing",
  "payment-basics": "billing",
  "record-payment": "billing",
  "payment-balance": "billing",
  "payment-history": "billing",
  "payment-status": "billing",
  "bulk-exports": "billing",
  expenses: "spending",
  "expense-approvals": "spending",
  retainers: "billing",
  employees: "people",
  salaries: "people",
  attendance: "people",
  "attendance-actions": "people",
  leave: "people",
  "leave-approval": "people",
  overtime: "people",
  "payroll-approval": "payroll",
  "payroll-workforce-review": "payroll",
  "payroll-payments": "payroll",
  team: "finish",
  settings: "finish",
};

function currentStepId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const candidate = LEGACY_STEP_ALIASES[value] ?? value;
  return TOUR_STEPS.some((step) => step.id === candidate) ? candidate : undefined;
}

export const tourStorageKey = (userId: string) => `puffinpal-tour-v1:${userId}`;
export function tourSteps(permissions: readonly Permission[]) {
  return TOUR_STEPS.filter(
    (step) =>
      step.requiredPermissions?.every((permission) => permissions.includes(permission)) ?? true,
  );
}
export function initialTour(user: User, saved: unknown): TourState {
  const savedStep =
    saved && typeof saved === "object" && "step" in saved ? currentStepId(saved.step) : undefined;
  if (
    saved &&
    typeof saved === "object" &&
    savedStep &&
    "active" in saved &&
    typeof saved.active === "boolean" &&
    "manual" in saved &&
    typeof saved.manual === "boolean"
  ) {
    const state = { ...(saved as TourState), step: savedStep };
    if (
      state.manual ||
      !state.active ||
      ["PENDING", "IN_PROGRESS"].includes(user.onboardingStatus ?? "")
    )
      return state;
  }
  return {
    active: user.onboardingStatus === "PENDING" || user.onboardingStatus === "IN_PROGRESS",
    manual: false,
    step:
      user.onboardingStatus === "IN_PROGRESS"
        ? (currentStepId(user.onboardingStep) ?? "welcome")
        : "welcome",
  };
}
export function adjacentStep(steps: readonly { id: string }[], current: string, direction: 1 | -1) {
  const index = steps.findIndex((step) => step.id === current);
  if (index < 0) {
    const original = TOUR_STEPS.findIndex((step) => step.id === current);
    const candidates = direction === 1 ? steps : [...steps].reverse();
    return (
      candidates.find(
        (step) => (TOUR_STEPS.findIndex((item) => item.id === step.id) - original) * direction > 0,
      )?.id ?? (direction === 1 ? steps[steps.length - 1]! : steps[0]!).id
    );
  }
  return steps[Math.max(0, Math.min(steps.length - 1, index + direction))]!.id;
}
export interface TourRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function visibleTourTarget(element: HTMLElement | null): element is HTMLElement {
  if (!element || element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
  );
}
export function tourPosition(
  target: TourRect | null,
  viewport: { width: number; height: number },
  panel: { width: number; height: number },
) {
  const gap = 16;
  const width = Math.min(panel.width, viewport.width - 24);
  const height = Math.min(panel.height, viewport.height - 24);
  let left = (viewport.width - width) / 2;
  let top = (viewport.height - height) / 2;
  if (target) {
    if (viewport.width - (target.left + target.width) >= width + gap) {
      left = target.left + target.width + gap;
      top = target.top;
    } else if (target.left >= width + gap) {
      left = target.left - width - gap;
      top = target.top;
    } else if (viewport.height - (target.top + target.height) >= height + gap) {
      left = target.left;
      top = target.top + target.height + gap;
    } else {
      left = target.left;
      top = target.top - height - gap;
    }
  }
  return {
    left: Math.max(12, Math.min(left, viewport.width - width - 12)),
    top: Math.max(12, Math.min(top, viewport.height - height - 12)),
    width,
  };
}
