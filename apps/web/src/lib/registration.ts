import type { CountryCode } from "libphonenumber-js/max";

export interface RegistrationDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  logoUrl: string | null;
  organizationName: string;
  organizationSlug: string;
  companyWebsite: string;
  employeeCount: string;
  currency: string;
  password: string;
  confirmPassword: string;
  phoneDisplay: string;
  phoneCountry: CountryCode;
  slugEdited: boolean;
}
export function createRegistrationDraft(slug = ""): RegistrationDraft {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    logoUrl: null,
    organizationName: "",
    organizationSlug: slug,
    companyWebsite: "",
    employeeCount: "",
    currency: "",
    password: "",
    confirmPassword: "",
    phoneDisplay: "",
    phoneCountry: "US",
    slugEdited: false,
  };
}
export function suggestedSlug(companyName: string) {
  const slug = companyName
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  return slug && slug.length < 3 ? `${slug}-workspace` : slug;
}
