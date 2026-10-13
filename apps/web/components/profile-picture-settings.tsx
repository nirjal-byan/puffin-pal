"use client";
import { useRef, useState, type FormEvent } from "react";
import { errorMessage, type Profile, type User, type WorkspaceApi } from "../lib/api";
import { CompanyLogoPicker } from "./company-logo-picker";

export function ProfilePictureSettings({ user, api, onProfileChange, onSaved }: {
  user: User;
  api: WorkspaceApi;
  onProfileChange: (profile: Profile) => void;
  onSaved: (message: string) => void;
}) {
  const [picture, setPicture] = useState(user.avatarUrl);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || preparing) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const profile = await api<Profile>("/auth/me/avatar", {
        method: "PATCH", body: { avatarUrl: picture },
      });
      onProfileChange(profile);
      onSaved("Your profile picture has been updated.");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return (
      <form className="settings-form company-logo-form" onSubmit={save}>
        {error && <p className="alert" role="alert">{error}</p>}
        <CompanyLogoPicker kind="profile" value={picture} onChange={setPicture}
          onBusyChange={setPreparing} disabled={busy} />
        <button type="submit" className="button primary settings-save"
          disabled={busy || preparing || picture === user.avatarUrl}>
          {busy ? "Saving…" : "Save profile picture"}
        </button>
      </form>
  );
}
