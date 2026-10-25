import type { ReactNode } from "react";
export default function PageLayout({
  children,
  withForm = false,
}: {
  children: ReactNode;
  withForm?: boolean;
}) {
  return <div className={`content-grid ${withForm ? "with-form" : ""}`}>{children}</div>;
}
