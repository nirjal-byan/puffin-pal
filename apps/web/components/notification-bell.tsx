"use client";
import { useEffect, useRef, useState } from "react";
export function NotificationBell({
  notifications,
  onClearNotifications,
}: {
  notifications: string[];
  onClearNotifications: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!notificationsOpen) return;
    function close(event: PointerEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        notificationRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [notificationsOpen]);

  return (
    <div className="notification-control" ref={notificationRef}>
      <button
        className="icon-button"
        type="button"
        onClick={() => setNotificationsOpen((open) => !open)}
        aria-label="Notifications"
        aria-expanded={notificationsOpen}
        aria-controls="notifications-panel"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {notifications.length > 0 && <span className="notification-dot" />}
      </button>
      {notificationsOpen && (
        <section
          className="notifications-panel"
          id="notifications-panel"
          aria-label="Notifications"
        >
          <div className="notifications-heading">
            <strong>Notifications</strong>
            {notifications.length > 0 && (
              <button className="text-button" type="button" onClick={() => onClearNotifications()}>
                Clear
              </button>
            )}
          </div>
          {notifications.length ? (
            <ul>
              {notifications.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          ) : (
            <p>
              You’re all caught up.
              <small>Workspace updates from this session will appear here.</small>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
