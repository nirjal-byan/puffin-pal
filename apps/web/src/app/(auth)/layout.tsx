import type { ReactNode } from "react";

export default function AuthenticationRouteLayout({ children }: { children: ReactNode }) {
  return <div className="auth-route-boundary">{children}</div>;
}
