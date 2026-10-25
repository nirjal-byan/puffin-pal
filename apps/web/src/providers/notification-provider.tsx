"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; message: string };
type NotificationContextValue = {
  notifications: string[];
  toast: Toast | null;
  notify: (message: string) => void;
  dismissToast: () => void;
  clearNotifications: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((message: string) => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message }));
    setNotifications((current) => [message, ...current].slice(0, 20));
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const value = useMemo(
    () => ({ notifications, toast, notify, dismissToast, clearNotifications }),
    [clearNotifications, dismissToast, notifications, notify, toast],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used within NotificationProvider");
  return value;
}
