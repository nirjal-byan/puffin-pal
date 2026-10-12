"use client";
import { useRef, useState, type FormEvent } from "react";
import { errorMessage, type Profile, type WorkspaceApi } from "../lib/api";
import { CompanyLogoPicker } from "./company-logo-picker";

export function CompanyLogoSettings({
  organization,
  api,
  onProfileChange,
  onSaved,
}: {
  organization: Profile["organization"];
  api: WorkspaceApi;
  onProfileChange: (profile: Profile) => void;
  onSaved: (message: string) => void;
}) {
  const [logo, setLogo] = useState(organization.logoUrl ?? null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || preparing) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const profile = await api<Profile>("/auth/organization/logo", {
        method: "PATCH",
        body: { logoUrl: logo },
      });
      onProfileChange(profile);
      onSaved("Company logo updated.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel company-logo-settings">
      <div className="panel-heading">
        <h3>Company logo</h3>
      </div>
      <form onSubmit={save} className="settings-form company-logo-form">
        <p className="muted company-logo-description">
          Personalize the workspace for {organization.name}.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <CompanyLogoPicker
          value={logo}
          onChange={setLogo}
          onBusyChange={setPreparing}
          disabled={busy}
        />
        <button
          type="submit"
          className="button primary settings-save"
          disabled={
            busy || preparing || logo === (organization.logoUrl ?? null)
          }
        >
          {busy ? "Saving…" : "Save company logo"}
        </button>
      </form>
    </section>
  );
}
