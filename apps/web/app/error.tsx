"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="route-state-page">
      <span className="eyebrow">Something went wrong</span>
      <h1>We couldn’t open this page</h1>
      <p>Your records were not changed. Try loading the page again.</p>
      <button className="button primary" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
