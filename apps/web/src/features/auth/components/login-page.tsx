"use client";
import { PasswordInput } from "@/components/ui/password-input";
import { Brand } from "@/components/layout/brand";
import LoginLayout from "./auth-layout";
import { createRegistrationDraft } from "@/lib/registration";
import { RegistrationFields } from "./registration-fields";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest, errorMessage, type Session } from "@/lib/api";

export default function LoginPage({
  initialSlug,
  notice,
  onAuthenticated,
}: {
  initialSlug: string;
  notice: string;
  onAuthenticated: (session: Session) => void;
}) {
  const [registrationDraft, setRegistrationDraft] = useState(() =>
    createRegistrationDraft(initialSlug),
  );
  const [signupStep, setSignupStep] = useState(0);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState("");
  const formAreaRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | null>(null);
  const cardAnimation = useRef<Animation | null>(null);

  useEffect(() => {
    document.title = `${signup ? "Create account" : "Sign in"} — PuffinPal`;
  }, [signup]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const area = formAreaRef.current;
    if (!card || !area) return;
    const fitCard = () => {
      if (card.dataset.mode === "signup") {
        card.style.setProperty("--auth-card-scale", "1");
        return;
      }
      const scale = Math.min(1, (area.clientHeight - 32) / card.offsetHeight);
      card.style.setProperty("--auth-card-scale", String(Math.max(0.1, scale)));
    };
    const observer = new ResizeObserver(fitCard);
    observer.observe(area);
    observer.observe(card);
    fitCard();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const from =
      cardAnimation.current?.playState === "running" ? card.offsetHeight : previousHeight.current;
    cardAnimation.current?.cancel();
    const to = card.offsetHeight;
    previousHeight.current = to;
    if (from !== null && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cardAnimation.current = card.animate(
        [
          { height: `${from}px`, overflow: "hidden" },
          { height: `${to}px`, overflow: "hidden" },
        ],
        { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  }, [signup, signupStep]);

  function switchMode(next: boolean) {
    if (next === signup) return;
    previousHeight.current = cardRef.current?.offsetHeight ?? null;
    setSignup(next);
    setSignupStep(0);
    setError("");
  }

  function validateStep(form: HTMLFormElement) {
    const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      '.registration-step:not([hidden]) input:not([type="hidden"]), .registration-step:not([hidden]) select',
    );
    for (const field of fields) if (!field.reportValidity()) return false;
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signup && logoBusy) {
      setError("Wait for the company logo to finish preparing.");
      return;
    }
    if (signup && !validateStep(event.currentTarget)) return;
    if (signup && signupStep === 1 && !registrationDraft.employeeCount) {
      setError("Choose the number of employees before continuing.");
      event.currentTarget
        .querySelector<HTMLButtonElement>('[data-dropdown-name="employeeCount"]')
        ?.focus();
      return;
    }
    if (signup && signupStep === 1 && !registrationDraft.currency) {
      setError("Choose your workspace currency before continuing.");
      event.currentTarget
        .querySelector<HTMLButtonElement>('[data-dropdown-name="currency"]')
        ?.focus();
      return;
    }
    if (signup && signupStep < 2) {
      setError("");
      previousHeight.current = cardRef.current?.offsetHeight ?? null;
      setSignupStep((step) => step + 1);
      return;
    }
    const data = new FormData(event.currentTarget);
    setError("");
    if (signup && data.get("password") !== data.get("confirmPassword")) {
      setError("Passwords do not match. Check your confirmation password.");
      return;
    }
    setBusy(true);
    const credentials = {
      organizationSlug: String(data.get("organizationSlug")).trim().toLowerCase(),
      email: String(data.get("email")).trim().toLowerCase(),
      password: String(data.get("password")),
    };
    try {
      const session = await apiRequest<Session>(signup ? "/auth/signup" : "/auth/login", {
        method: "POST",
        body: signup
          ? {
              ...credentials,
              organizationName: String(data.get("organizationName")),
              ...(registrationDraft.logoUrl ? { logoUrl: registrationDraft.logoUrl } : {}),
              fullName: [data.get("firstName"), data.get("middleName"), data.get("lastName")]
                .map((part) => String(part ?? "").trim())
                .filter(Boolean)
                .join(" "),
              firstName: String(data.get("firstName")).trim(),
              middleName: String(data.get("middleName") ?? "").trim(),
              lastName: String(data.get("lastName")).trim(),
              phoneNumber: String(data.get("phoneNumber")),
              companyWebsite: String(data.get("companyWebsite")).trim(),
              employeeCount: String(data.get("employeeCount")),
              currency: String(data.get("currency")),
              confirmPassword: String(data.get("confirmPassword")),
            }
          : credentials,
      });
      onAuthenticated(session);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LoginLayout formAreaRef={formAreaRef} signup={signup}>
      <div className="auth-form-card" ref={cardRef} data-mode={signup ? "signup" : "login"}>
        {signup && (
          <button
            type="button"
            className="registration-back"
            disabled={busy}
            onClick={() => switchMode(false)}
          >
            ← Back to sign in
          </button>
        )}
        <div className="auth-card-brand">
          <Brand />
        </div>
        <h2 key={signup ? "signup-heading" : "login-heading"}>
          {signup ? "Create your workspace" : "Log in"}
        </h2>
        {signup && (
          <ol className="registration-progress" aria-label="Registration progress">
            {["Your details", "Company", "Security"].map((label, index) => (
              <li
                key={label}
                className={index <= signupStep ? "reached" : ""}
                aria-current={index === signupStep ? "step" : undefined}
              >
                <span>{index < signupStep ? "✓" : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit} noValidate={signup} key={signup ? "signup" : "login"}>
          <fieldset disabled={busy} className="form-fields">
            {signup ? (
              <RegistrationFields
                onLogoBusyChange={setLogoBusy}
                step={signupStep}
                draft={registrationDraft}
                onDraftChange={(patch) =>
                  setRegistrationDraft((current) => ({ ...current, ...patch }))
                }
              />
            ) : (
              <>
                <label>
                  Organization slug
                  <input
                    name="organizationSlug"
                    required
                    defaultValue={initialSlug}
                    minLength={3}
                    maxLength={63}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="acme-studio"
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                  <span className="field-hint">
                    {signup
                      ? "A unique name using lowercase letters, numbers, and hyphens."
                      : "Use the slug you chose when creating your organization."}
                  </span>
                </label>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder="you@company.com"
                    autoComplete="username"
                  />
                </label>
                <label>
                  Password
                  <PasswordInput
                    name="password"
                    required
                    minLength={signup ? 12 : 1}
                    maxLength={128}
                    placeholder={signup ? "At least 12 characters" : "Your password"}
                    autoComplete={signup ? "new-password" : "current-password"}
                  />
                </label>
              </>
            )}
            <div className={signup ? "registration-actions" : ""}>
              {signup && signupStep > 0 && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    previousHeight.current = cardRef.current?.offsetHeight ?? null;
                    setSignupStep((step) => step - 1);
                    setError("");
                  }}
                >
                  ← Previous
                </button>
              )}
              <button className={`button primary ${signup ? "" : "full"}`} type="submit">
                {busy
                  ? "Creating workspace…"
                  : signup
                    ? signupStep < 2
                      ? "Continue →"
                      : "Create workspace →"
                    : "Log in →"}
              </button>
            </div>
          </fieldset>
        </form>
        {!signup && (
          <p className="auth-switch">
            New to PuffinPal?{" "}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => switchMode(true)}
            >
              Create an organization
            </button>
          </p>
        )}
        <p className="auth-note">Each organization has its own accounts and business records.</p>
      </div>
    </LoginLayout>
  );
}
