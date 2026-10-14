"use client";
import { ThemeSwitch } from "./theme-switch";
import { NotificationBell } from "./notification-bell";
import { Brand } from "./brand";
import type { Session } from "../lib/api";
import Link from "next/link";
import { NAV_SECTIONS, sectionForTab, tabHref, type Tab, type NavigationSection } from "../lib/navigation";
import { currencyDetails } from "../lib/currencies";

export function Navbar({
  session,
  tab,
  area,
  theme,
  toggleTheme,
  notifications,
  onClearNotifications,
}: {
  session: Session;
  tab: Tab;
  area: NavigationSection;
  theme: "light" | "dark";
  toggleTheme: () => void;
  notifications: string[];
  onClearNotifications: () => void;
}) {
  const currency = currencyDetails(session.organization.currency);
  return (
    <header className="workspace-header">
      <Brand inverted={theme === "dark"} />
      <span className="header-divider" aria-hidden="true" />
      <span className="header-workspace-name">{session.organization.name}</span>
      <nav className="header-shortcuts" aria-label="Platform navigation">
        {NAV_SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={tabHref(section.tabs[0]!, section.key)}
            aria-current={sectionForTab(tab, area).key === section.key ? "location" : undefined}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <details className="currency-menu">
          <summary aria-label={`Workspace currency: ${currency.code}`}>
            <span aria-hidden="true">{currency.flag}</span> {currency.code}
          </summary>
          <div className="currency-menu-panel">
            <strong><span aria-hidden="true">{currency.flag}</span> {currency.code}</strong>
            <span>{currency.name}</span>
            <small>Workspace currency</small>
          </div>
        </details>
        <button type="button" className="button secondary tour-launch" data-tour="tutorial"
          onClick={() => window.dispatchEvent(new Event("puffinpal:start-tour"))}>
          Tutorial
        </button>
        <ThemeSwitch theme={theme} toggleTheme={toggleTheme} />
        <NotificationBell
          notifications={notifications}
          onClearNotifications={onClearNotifications}
        />
      </div>
    </header>
  );
}
