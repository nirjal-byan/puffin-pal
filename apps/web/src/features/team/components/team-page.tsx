"use client";
import { PasswordInput } from "@/components/ui/password-input";
import PageLayout from "./team-layout";
import { useState, type FormEvent } from "react";
import { ROLES, canAssignRole, type Role } from "@puffinpal/permissions";
import { roleLabel, type Member } from "@/lib/api";
import type { WorkspaceApi } from "@/lib/api";

export default function TeamPage({
  members,
  role,
  api,
  onSaved,
  onError,
}: {
  members: Member[];
  role: Role;
  api: WorkspaceApi;
  onSaved: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const assignable = ROLES.filter((target) => canAssignRole(role, target));
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try {
      await api("/members", {
        method: "POST",
        body: {
          fullName: String(fields.get("fullName")),
          email: String(fields.get("email")),
          password: String(fields.get("password")),
          role: String(fields.get("role")),
        },
      });
      form.reset();
      onSaved("Team member added. They can now sign in with this organization’s slug.");
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  async function changeRole(event: FormEvent<HTMLFormElement>, member: Member) {
    event.preventDefault();
    const nextRole = String(new FormData(event.currentTarget).get("role"));
    setBusy(true);
    try {
      await api(`/members/${member.userId}/role`, {
        method: "PATCH",
        body: { role: nextRole },
      });
      onSaved("Role updated. New permissions apply on their next request.");
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageLayout>
      <section className="panel">
        <div className="panel-heading">
          <h3>Your team</h3>
          <span className="muted">{members.length} on this page</span>
        </div>
        <div className="member-list">
          {members.map((member) => (
            <article className="member-row" key={member.id}>
              <span className="avatar">
                {(member.user?.fullName ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="member-info">
                <strong>{member.user?.fullName ?? "Unavailable account"}</strong>
                <small>{member.user?.email ?? ""}</small>
                <span className="role-badge">{roleLabel(member.role)}</span>
              </div>
              {canAssignRole(role, member.role) ? (
                <form className="role-form" onSubmit={(event) => changeRole(event, member)}>
                  <label className="sr-only" htmlFor={`role-${member.id}`}>
                    Role for {member.user?.fullName}
                  </label>
                  <select
                    id={`role-${member.id}`}
                    name="role"
                    defaultValue={member.role}
                    key={member.role}
                    disabled={busy}
                  >
                    {assignable.map((target) => (
                      <option key={target} value={target}>
                        {roleLabel(target)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="button secondary compact" disabled={busy}>
                    Save role
                  </button>
                </form>
              ) : (
                <span className="muted">Protected role</span>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="panel form-panel">
        <span className="eyebrow">Grow your team</span>
        <h3>Add a team member</h3>
        <p className="muted form-description">Create an account for this organization.</p>
        <form onSubmit={create}>
          <fieldset disabled={busy} className="form-fields">
            <label>
              Full name
              <input name="fullName" required maxLength={120} placeholder="Team member’s name" />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                placeholder="colleague@company.com"
              />
            </label>
            <label>
              Initial password
              <PasswordInput
                name="password"
                visibilityLabel="initial password"
                required
                minLength={12}
                maxLength={128}
                placeholder="At least 12 characters"
                autoComplete="new-password"
              />
            </label>
            <label>
              Role
              <select name="role" defaultValue="FINANCE_VIEWER">
                {assignable.map((target) => (
                  <option key={target} value={target}>
                    {roleLabel(target)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button primary">
              {busy ? "Adding…" : "Add member +"}
            </button>
          </fieldset>
        </form>
        <p className="field-hint">Share the credentials privately with your colleague.</p>
      </section>
    </PageLayout>
  );
}
