import { PasswordInput } from "@/components/ui/password-input";

export function LoginFields({ initialSlug }: { initialSlug: string }) {
  return (
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
        <span className="field-hint">Use the slug you chose when creating your organization.</span>
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
          minLength={1}
          maxLength={128}
          placeholder="Your password"
          autoComplete="current-password"
        />
      </label>
    </>
  );
}
