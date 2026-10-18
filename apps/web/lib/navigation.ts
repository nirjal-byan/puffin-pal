import type { Permission } from "@puffinpal/permissions";

export type Tab =
  | "overview"
  | "clients"
  | "members"
  | "employees"
  | "invoices"
  | "expenses"
  | "retainers"
  | "access"
  | "profile"
  | "password";
export const NAV: {
  key: Tab;
  label: string;
  icon: string;
  permission: Permission;
}[] = [
  { key: "overview", label: "Overview", icon: "", permission: "profile:read" },
  { key: "clients", label: "Clients", icon: "◈", permission: "clients:read" },
  { key: "employees", label: "Employees", icon: "♙", permission: "employees:read" },
  {
    key: "invoices",
    label: "Invoices",
    icon: "▤",
    permission: "invoices:read",
  },
  {
    key: "expenses",
    label: "Expenses",
    icon: "↗",
    permission: "expenses:read",
  },
  {
    key: "retainers",
    label: "Retainers",
    icon: "↻",
    permission: "retainers:read",
  },
  { key: "members", label: "Team", icon: "♧", permission: "members:read" },
  {
    key: "profile",
    label: "Edit profile",
    icon: "",
    permission: "profile:read",
  },
  {
    key: "password",
    label: "Change password",
    icon: "",
    permission: "profile:read",
  },
  {
    key: "access",
    label: "My access",
    icon: "◎",
    permission: "profile:read",
  },
];
// Clients are available in both Workspace and People; the URL retains that context.
export type NavigationSection = "workspace" | "people" | "settings";
export const NAV_SECTIONS: { key: NavigationSection; label: string; tabs: Tab[] }[] = [
  { key: "workspace", label: "Workspace", tabs: ["overview", "clients", "invoices", "expenses", "retainers"] },
  { key: "people", label: "People", tabs: ["clients", "employees", "members"] },
  { key: "settings", label: "Settings", tabs: ["profile", "password", "access"] },
];

export function sectionForTab(tab: Tab, area?: string | null) {
  const requested = NAV_SECTIONS.find((section) => section.key === area && section.tabs.includes(tab));
  if (requested) return requested;
  // Keep existing client links in People unless Workspace was explicitly selected.
  if (tab === "clients") return NAV_SECTIONS.find((section) => section.key === "people")!;
  return NAV_SECTIONS.find((section) => section.tabs.includes(tab))!;
}

export function tabHref(tab: Tab, area?: NavigationSection): string {
  if (tab === "overview") return "/";
  if (tab === "invoices") return "/invoices";
  return `/?section=${tab}${tab === "clients" && area === "workspace" ? "&area=workspace" : ""}`;
}

export function resolveTab(pathname: string, section: string | null, fallback: Tab = "overview"): Tab {
  if (pathname === "/invoices" || pathname === "/invoices/new") return "invoices";
  return NAV.some((item) => item.key === section) ? section as Tab : fallback;
}

export const ICON_PATHS: Record<Tab, string> = {
  overview: "M2 2h6v6H2z M12 2h6v6h-6z M2 12h6v6H2z M12 12h6v6h-6z",
  profile: "M10 10a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M3 18v-1a7 7 0 0 1 14 0v1",
  password: "M5 8V6a5 5 0 0 1 10 0v2 M3 8h14v10H3z M10 12v3",
  clients:
    "M4 3h12v14H4z M8 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M7 14v-1a3 3 0 0 1 6 0v1",
  invoices: "M5 2h10v16l-2-1-3 1-3-1-2 1z M8 6h4 M8 10h4",
  expenses: "M3 14l5-5 3 3 6-8 M12 4h5v5",
  retainers:
    "M16 7a6 6 0 0 0-10-2L3 8 M3 3v5h5 M4 13a6 6 0 0 0 10 2l3-3 M17 17v-5h-5",
  members:
    "M7 9a3 3 0 1 0 0-6a3 3 0 1 0 0 6 M2 17v-2a5 5 0 0 1 10 0v2 M14 4a3 3 0 0 1 0 6 M15 12a4 4 0 0 1 3 4v1",
  employees: "M10 10a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M3 18v-1a7 7 0 0 1 14 0v1 M15 3h3 M16.5 1.5v3",
  access: "M10 2l7 3v5c0 4-7 8-7 8S3 14 3 10V5z M7 10l2 2 4-4",
};

export const DESCRIPTION: Record<Tab, string> = {
  overview: "A clear starting point for your business.",
  profile: "Keep your personal information up to date.",
  password: "Update the password you use to sign in.",
  clients: "The people and businesses you work with.",
  members: "The right people. The right permissions.",
  employees: "Your employee directory and compensation history.",
  invoices: "Your organization’s invoice records.",
  expenses: "Keep an eye on your business spending.",
  retainers: "Your recurring client relationships.",
  access: "Your account and permissions in this organization.",
};
