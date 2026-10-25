import type { ReactNode } from "react";
export default function AccessLayout({ children }: { children: ReactNode }) {
  return <section className="panel access-panel">{children}</section>;
}
