import type { Session, WorkspaceApi } from "@/lib/api";
import { NAV, ICON_PATHS, DESCRIPTION, type Tab } from "@/lib/navigation";
import OverviewLayout from "./overview-layout";
import { FinancialDashboard } from "./financial-dashboard";

export default function OverviewPage({
  session,
  navigate,
  api,
}: {
  session: Session;
  navigate: (tab: Tab) => void;
  api: WorkspaceApi;
}) {
  const sections = NAV.filter(
    (item) =>
      ["clients", "invoices", "expenses", "retainers", "cash-flow", "members"].includes(item.key) &&
      session.permissions.includes(item.permission),
  );
  return (
    <OverviewLayout>
      <div className="overview-dashboard-grid">
        <FinancialDashboard api={api} />
        <aside className="panel overview-explore-panel" aria-labelledby="overview-sections">
          <header>
            <span className="eyebrow">Quick access</span>
            <h3 id="overview-sections">Explore your workspace</h3>
          </header>
          <div className="overview-links">
            {sections.map((item) => (
              <button
                type="button"
                key={item.key}
                className="overview-link"
                onClick={() => navigate(item.key)}
              >
                <span className="overview-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={ICON_PATHS[item.key]} />
                  </svg>
                </span>
                <span className="overview-link-copy">
                  <strong>{item.label}</strong>
                  <small>{DESCRIPTION[item.key]}</small>
                </span>
                <span className="overview-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </OverviewLayout>
  );
}
