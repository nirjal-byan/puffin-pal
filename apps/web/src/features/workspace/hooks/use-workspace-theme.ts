import { useState } from "react";
import { flushSync } from "react-dom";

export function useWorkspaceTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = localStorage.getItem("puffinpal-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* Local storage may be unavailable. */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    const applyTheme = () => flushSync(() => setTheme(next));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduceMotion) applyTheme();
    else {
      document.documentElement.classList.add("theme-view-transition");
      const transition = document.startViewTransition(applyTheme);
      const finish = () => document.documentElement.classList.remove("theme-view-transition");
      void transition.finished.then(finish, finish);
    }
    try {
      localStorage.setItem("puffinpal-theme", next);
    } catch {
      /* Theme still applies for the current page. */
    }
  }
  return { theme, toggleTheme };
}
