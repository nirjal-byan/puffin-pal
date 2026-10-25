import type { ReactNode } from "react";
export default function OverviewLayout({ children }: { children: ReactNode }) {
  return <div className="overview-layout">{children}</div>;
}
