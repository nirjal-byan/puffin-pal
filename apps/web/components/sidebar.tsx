"use client";
import type { Permission } from "@puffinpal/permissions";
import { roleLabel, type Session } from "../lib/api";
import Link from "next/link";
import { NAV, ICON_PATHS, sectionForTab, tabHref, type Tab, type NavigationSection } from "../lib/navigation";

export function Sidebar({
  session,
  tab,
  area,
  onSignOut,
}: {
  session: Session;
  tab: Tab;
  area: NavigationSection;
  onSignOut: () => void;
}) {
  const can = (permission: Permission) =>
    session.permissions.includes(permission);
  const section = sectionForTab(tab, area);
  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">{section?.label ?? "My access"}</h2>
      <div className="organization-card">
        <span className="organization-icon">
          {session.organization.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{session.organization.name}</strong>
          <small>{session.organization.slug}</small>
        </div>
      </div>
      <nav aria-label="Workspace navigation">
        {section ? (
          <div className="nav-group">
            <span className="nav-label">Pages</span>
            {section.tabs.map((key) => NAV.find((item) => item.key === key)!).map((item) => (
              <Link
                href={tabHref(item.key, section.key)}
                key={item.key}
                aria-current={tab === item.key ? "page" : undefined}
                className={`nav-item ${tab === item.key ? "selected" : ""}`}
              >
                <span aria-hidden="true">
                  <svg
                    width="17"
                    height="17"
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
                {item.label}
                {!can(item.permission) && (
                  <span className="nav-lock" aria-label="Restricted">
                    •
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="sidebar-context-note">Review your role and permissions here. Choose a section above to return to your workspace.</p>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="account">
          <span className="avatar">
            {session.user.fullName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{session.user.fullName}</strong>
            <small>{roleLabel(session.role)}</small>
          </div>
        </div>
        <button className="sign-out" type="button" onClick={() => onSignOut()}>
          Sign out ↗
        </button>
      </div>
    </aside>
  );
}
