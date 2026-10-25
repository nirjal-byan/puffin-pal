"use client";

import type { ReactNode } from "react";
import { NotificationProvider } from "./notification-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}
