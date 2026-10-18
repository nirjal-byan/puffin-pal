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
    title: "Finalize, then download",
    description:
      "Owners and admins can issue a draft from its detail page. Issuance locks billing details and amounts; issued invoices can be downloaded as PDFs.",
  },
  {
    id: "payment-basics",
    route: "/invoices",
    target: "page-heading",
    requiredPermissions: ["invoices:record-payment"],
    title: "Record money received",
    description:
      "Open an issued invoice and choose Record Payment. Enter the amount, date and method. Record the full balance or a partial payment; nothing is submitted during this tour.",
  },
  {
    id: "record-payment",
    detail: true,
    target: "record-payment",
    requiredPermissions: ["invoices:record-payment"],
    title: "Full or partial payments",
    description:
      "Use this button after receiving money. You can add a reference and notes. Each payment reduces the balance, and payments cannot exceed what is outstanding.",
  },
  {
    id: "payment-balance",
    detail: true,
    target: "invoice-balances",
    requiredPermissions: ["invoices:read"],
    title: "See what remains",
    description:
      "Total paid adds up recorded payments. Outstanding shows what is still owed. A partial payment leaves a balance; paying in full marks the invoice PAID.",
  },
  {
    id: "payment-history",
    detail: true,
    target: "payment-history",
    requiredPermissions: ["invoices:read"],
    title: "Review payment history",
    description:
      "Review each payment’s date, amount, method, reference and notes here. Recorded payments cannot be edited or removed.",
  },
  {
    id: "payment-status",
    route: "/invoices",
    target: "page-heading",
    requiredPermissions: ["invoices:read"],
    title: "Know what is due",
    description:
      "The invoice list shows paid and outstanding amounts. PAID means no balance remains. OVERDUE appears when a balance remains after the due date, using UTC calendar days.",
  },
  {
    id: "bulk-exports",
    route: "/invoices",
    target: "invoice-list",
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
    target: "expense-list",
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
    target: "employee-list",
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
  if (
    saved &&
    typeof saved === "object" &&
    "step" in saved &&
    TOUR_STEPS.some((step) => step.id === saved.step) &&
    "active" in saved &&
    typeof saved.active === "boolean" &&
    "manual" in saved &&
    typeof saved.manual === "boolean"
  ) {
    const state = saved as TourState;
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
      user.onboardingStatus === "IN_PROGRESS" &&
      TOUR_STEPS.some((step) => step.id === user.onboardingStep)
        ? user.onboardingStep!
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
