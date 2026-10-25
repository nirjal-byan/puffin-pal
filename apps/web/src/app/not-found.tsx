import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="route-state-page">
      <Image src="/puffinpal-icon.svg" alt="" width="48" height="48" />
      <span className="eyebrow">404</span>
      <h1>Page not found</h1>
      <p>The page may have moved, or you may not have access to it.</p>
      <Link className="button primary" href="/">
        Return to workspace
      </Link>
    </main>
  );
}
