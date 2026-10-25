import { redirect } from "next/navigation";

/** PuffinPal's session-aware root remains the canonical authentication entry. */
export default function LoginRoute() {
  redirect("/");
}
