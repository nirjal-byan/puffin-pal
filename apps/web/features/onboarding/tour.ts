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
    id: "dashboard",
    route: "/",
    target: "dashboard-summary",
    title: "Financial overview",
    description: "Review revenue, payments, outstanding balances, expenses, and cash flow.",
  },
  {
    id: "dashboard-charts",
    route: "/",
    target: "dashboard-charts",
    title: "Spot financial trends",
    description: "Use charts and date filters to understand billing and spending over time.",
    requiredPermissions: ["invoices:read", "expenses:read"],
  },
  {
    id: "clients",
    route: "/?section=clients&area=workspace",
    target: "nav-clients",
    requiredPermissions: ["clients:read"],
    title: "Keep your clients together",
    description: "Manage client names and billing details here, ready for your invoices.",
  },
  {
    id: "invoices",
    route: "/invoices",
    target: "nav-invoices",
    requiredPermissions: ["invoices:read"],
    title: "Manage your invoices",
    description:
      "Find invoice records, open their details, and edit drafts when your role allows it.",
  },
  {
    id: "create-invoice",
    route: "/invoices",
    target: "create-invoice",
    requiredPermissions: ["invoices:create"],
    title: "Start with a draft",
    description:
      "Create Invoice opens the form for your client, dates and line items. Nothing is created during this tour.",
  },
  {
    id: "issuance",
    route: "/invoices",
    target: "page-heading",
    requiredPermissions: ["invoices:read"],
    title: "Issue and track invoices",
    description:
      "Issuing locks billing details and enables PDF downloads. The list then shows paid, outstanding, and overdue status.",
  },
  {
    id: "payment-basics",
    route: "/invoices",
    target: "page-heading",
    requiredPermissions: ["invoices:record-payment"],
    title: "Track payments",
    description:
      "Record full or partial payments on issued invoices. Each entry updates the outstanding balance and stays available in payment history.",
  },
  {
    id: "bulk-exports",
    route: "/invoices",
    target: "page-heading",
    requiredPermissions: ["invoices:read"],
    title: "Export invoice PDFs",
    description: "Select eligible invoices to prepare a private ZIP export in the background.",
  },
  {
    id: "expenses",
    route: "/?section=expenses&area=workspace",
    target: "nav-expenses",
    requiredPermissions: ["expenses:read"],
    title: "Track business expenses",
    description: "Record costs, choose categories, attach private receipts, and filter the list.",
  },
  {
    id: "expense-approvals",
    route: "/?section=expenses&area=workspace",
    target: "page-heading",
    requiredPermissions: ["expenses:approve"],
    title: "Review submitted expenses",
    description: "Approve or reject pending expenses and review their approval history.",
  },
  {
    id: "retainers",
    route: "/?section=retainers&area=workspace",
    target: "nav-retainers",
    requiredPermissions: ["retainers:read"],
    title: "Automate repeat billing",
    description: "Manage recurring schedules, generated invoices, and paused or active retainers.",
  },
  {
    id: "employees",
    route: "/?section=employees",
    target: "nav-employees",
    requiredPermissions: ["employees:read"],
    title: "Manage employees",
    description: "Keep employee profiles, departments, reporting managers, and status together.",
  },
  {
    id: "salaries",
    route: "/?section=employees",
    target: "page-heading",
    requiredPermissions: ["salaries:read"],
    title: "Review compensation history",
    description: "Authorized users can view effective-dated salaries and compensation components.",
  },
  {
    id: "team",
    route: "/?section=members",
    target: "nav-members",
    requiredPermissions: ["members:manage"],
    title: "Invite your team",
    description: "Add teammates and choose their roles to give them the access they need.",
  },
  {
    id: "settings",
    route: "/?section=profile",
    target: "page-heading",
    title: "Make yourself at home",
    description:
      "Update your profile here. Owners and admins can also manage the company logo in Settings.",
  },
  {
    id: "finish",
    title: "You’re ready to go",
    description:
      "Start with a client or explore your invoices. Use Tutorial in the top bar whenever you need another look.",
  },
];

export interface TourState {
  active: boolean;
  manual: boolean;
  step: string;
  invoiceRoute?: string;
  direction?: 1 | -1;
}
const LEGACY_STEP_ALIASES: Readonly<Record<string, string>> = {
  "record-payment": "payment-basics",
  "payment-balance": "payment-basics",
  "payment-history": "payment-basics",
  "payment-status": "issuance",
};

function currentStepId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const candidate = LEGACY_STEP_ALIASES[value] ?? value;
  return TOUR_STEPS.some((step) => step.id === candidate) ? candidate : undefined;
}

export function invoiceTourRoute(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^\/invoices\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}
export function paymentTourLink(
  root: Pick<Document, "querySelector">,
  requireRecordButton: boolean,
) {
  const link = root.querySelector<HTMLAnchorElement>(
    requireRecordButton ? 'a[data-tour-payment-invoice="record"]' : "a[data-tour-payment-invoice]",
  );
  return invoiceTourRoute(link?.getAttribute("href"));
}
export const tourStorageKey = (userId: string) => `puffinpal-tour-v1:${userId}`;
export function paymentTourWaiting(root: Pick<Document, "querySelector">) {
  return root.querySelector('.workspace-main .panel.loading[role="status"]') !== null;
}
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
