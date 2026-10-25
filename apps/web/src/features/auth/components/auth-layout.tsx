import type { ReactNode, Ref } from "react";
import Image from "next/image";
import { Brand } from "@/components/layout/brand";

const loginFeatures = [
  {
    title: "Invoices, organized",
    description: "Create invoice drafts and keep client billing in view.",
    path: "M5 2h10v16l-2-1-3 1-3-1-2 1z M8 6h4 M8 10h4",
  },
  {
    title: "Expenses, in perspective",
    description: "Keep track of your organization’s spending.",
    path: "M3 14l5-5 3 3 6-8 M12 4h5v5",
  },
  {
    title: "Retainers, together",
    description: "A home for your recurring client relationships.",
    path: "M16 7a6 6 0 0 0-10-2L3 8 M3 3v5h5 M4 13a6 6 0 0 0 10 2l3-3 M17 17v-5h-5",
  },
];
const signupFeatures = [
  {
    title: "A home for your business",
    description: "Bring invoices, expenses, and retainers into one workspace.",
    path: "M2 2h6v6H2z M12 2h6v6h-6z M2 12h6v6H2z M12 12h6v6h-6z",
  },
  {
    title: "Your people, connected",
    description: "Keep your clients and teammates together.",
    path: "M7 9a3 3 0 1 0 0-6a3 3 0 1 0 0 6 M2 17v-2a5 5 0 0 1 10 0v2 M14 4a3 3 0 0 1 0 6 M15 12a4 4 0 0 1 3 4v1",
  },
  {
    title: "The right access",
    description: "Give each teammate a role that fits their work.",
    path: "M10 2l7 3v5c0 4-7 8-7 8S3 14 3 10V5z M7 10l2 2 4-4",
  },
];

export default function LoginLayout({
  signup = false,
  children,
  formAreaRef,
}: {
  signup?: boolean;
  children: ReactNode;
  formAreaRef: Ref<HTMLElement>;
}) {
  const features = signup ? signupFeatures : loginFeatures;
  return (
    <main className={`auth-layout ${signup ? "registration-layout" : ""}`}>
      <section className={`auth-story login-story ${signup ? "signup-story" : ""}`}>
        <Brand inverted />
        <Image
          src={signup ? "/images/signup-earthrise.jpg" : "/images/login-spacewalk.jpg"}
          alt=""
          fill
          priority
          sizes="(max-width: 760px) 100vw, (max-width: 1000px) 42vw, 33vw"
          className="login-space-image"
        />
        <div className="login-story-heading">
          <span className="eyebrow light">
            {signup ? "A fresh start for your business" : "A clear view of your business"}
          </span>
          <h1>
            {signup ? "Your business." : "Your numbers."}
            <br />
            <em>{signup ? "A new perspective." : "One workspace."}</em>
          </h1>
          <p>
            {signup
              ? "Create your organization and give your daily finances a home."
              : "Bring your daily finances into focus with PuffinPal."}
          </p>
        </div>
        <ul
          className="login-story-features"
          aria-label={signup ? "Your new workspace" : "PuffinPal features"}
        >
          {features.map((feature) => (
            <li key={feature.title}>
              <span className="login-feature-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={feature.path} />
                </svg>
              </span>
              <div>
                <strong>{feature.title}</strong>
                <p>{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="story-foot">
          {signup
            ? "Your organization. Your team. Your workspace."
            : "Clients · Invoices · Expenses · Retainers · Team"}
        </p>
      </section>
      <section className="auth-form-area" ref={formAreaRef}>
        {children}
      </section>
    </main>
  );
}
