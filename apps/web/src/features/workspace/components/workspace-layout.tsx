import type { ReactNode } from "react";
export default function WorkspaceLayout({
  theme,
  children,
}: {
  theme: "light" | "dark";
  children: ReactNode;
}) {
  return (
    <div className="workspace-layout" data-theme={theme}>
      {children}
    </div>
  );
}
