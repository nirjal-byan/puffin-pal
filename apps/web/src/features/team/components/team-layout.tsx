import type { ReactNode } from "react";
export default function PageLayout({ children }: { children: ReactNode }) {
  return <div className="content-grid with-form">{children}</div>;
}
