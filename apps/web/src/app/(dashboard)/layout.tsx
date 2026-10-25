import type { ReactNode } from "react";

/**
 * Route boundary for authenticated workspace destinations.
 * Authentication and organization restoration currently live in DashboardEntry
 * because the session is stored client-side; the visual shell is mounted only
 * after that boundary has resolved.
 */
export default function DashboardRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
