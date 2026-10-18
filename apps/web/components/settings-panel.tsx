"use client";
import { PasswordInput } from "./password-input";
import { ProfilePictureSettings } from "./profile-picture-settings";
import { useState, type FormEvent } from "react";
import type { Profile, User } from "../lib/api";
import { errorMessage } from "../lib/api";
import type { WorkspaceApi } from "../lib/api";

export function SettingsPanel({
  mode,
  user,
  api,
  onProfileChange,
  onSaved,
}: {
  mode: "profile" | "password";
  user: User;
  api: WorkspaceApi;
  onProfileChange: (profile: Profile) => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    if (mode === "password" && data.get("newPassword") !== data.get("confirmPassword")) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "profile") {
        onProfileChange(
          await api<Profile>("/auth/me", {
            method: "PATCH",
            body: { fullName: String(data.get("fullName")).trim() },
          }),
        );
        onSaved("Your profile has been updated.");
      } else {
        await api("/auth/change-password", {
          method: "POST",
          body: {
            currentPassword: String(data.get("currentPassword")),
            newPassword: String(data.get("newPassword")),
          },
        });
        form.reset();
        onSaved("Your password has been updated.");
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <h3>{mode === "profile" ? "Personal information" : "Account security"}</h3>
      </div>
      {mode === "profile" && (
        <ProfilePictureSettings
          key={user.id}
          user={user}
          api={api}
          onProfileChange={onProfileChange}
          onSaved={onSaved}
        />
      )}
      <form onSubmit={submit} className="settings-form">
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="form-fields">
          {mode === "profile" ? (
            <>
              <label>
                Full name
                <input
                  name="fullName"
                  required
                  maxLength={120}
                  pattern=".*\S.*"
                  defaultValue={user.fullName}
                  autoComplete="name"
                />
              </label>
              <label>
                Email address
                <input value={user.email} readOnly type="email" />
                <span className="field-hint">
                  Your sign-in email is managed by your organization.
                </span>
              </label>
            </>
          ) : (
            <>
              <label>
                Current password
                <PasswordInput
                  name="currentPassword"
                  visibilityLabel="current password"
                  required
                  maxLength={128}
                  autoComplete="current-password"
                />
              </label>
              <label>
                New password
                <PasswordInput
                  name="newPassword"
                  visibilityLabel="new password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <span className="field-hint">Use at least 12 characters.</span>
              </label>
              <label>
                Confirm new password
                <PasswordInput
                  name="confirmPassword"
                  visibilityLabel="confirmation password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            </>
          )}
          <button className="button primary settings-save" type="submit">
            {busy ? "Saving…" : mode === "profile" ? "Save profile" : "Update password"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
