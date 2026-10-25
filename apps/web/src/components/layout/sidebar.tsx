"use client";
import { roleLabel, type Session } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import {
  NAV,
  ICON_PATHS,
  canAccessNavigationItem,
  sectionForTab,
  tabHref,
  type Tab,
  type NavigationSection,
} from "@/lib/navigation";

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
  const section = sectionForTab(tab, area);
  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">{section?.label ?? "My access"}</h2>
      <div className="organization-card">
        <span className={`organization-icon${session.organization.logoUrl ? " has-image" : ""}`}>
          {session.organization.logoUrl ? (
            <Image
              src={session.organization.logoUrl}
              alt={`${session.organization.name} logo`}
              width={36}
              height={36}
              unoptimized
              className="company-logo-thumbnail"
            />
          ) : (
            session.organization.name.slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <strong>{session.organization.name}</strong>
        </div>
      </div>
      <nav aria-label={`${section.label} navigation`}>
        {section ? (
          <div className="nav-group">
            <span className="nav-label">{section.sidebarLabel}</span>
            {section.tabs
              .filter((key) => canAccessNavigationItem(key, session.permissions))
              .map((key) => NAV.find((item) => item.key === key)!)
              .map((item) => (
                <Link
                  data-tour={`nav-${item.key}`}
                  href={tabHref(item.key)}
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
                  {item.sidebarLabel ?? item.label}
                </Link>
              ))}
          </div>
        ) : (
          <p className="sidebar-context-note">
            Review your role and permissions here. Choose a section above to return to your
            workspace.
          </p>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="account">
          <span className="avatar">
            {session.user.avatarUrl ? (
              <Image
                src={session.user.avatarUrl}
                alt={`${session.user.fullName} profile picture`}
                width={36}
                height={36}
                unoptimized
                className="profile-picture-thumbnail"
              />
            ) : (
              session.user.fullName.slice(0, 1).toUpperCase()
            )}
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
