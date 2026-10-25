import type { ReactNode } from "react";
export default function FinancialLayout({ children }: { children: ReactNode }) {
  return <div className="content-grid">{children}</div>;
}
