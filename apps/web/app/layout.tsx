import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const siteFont = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-site",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PuffinPal — Your workspace",
    template: "%s — PuffinPal",
  },
  description: "Manage your clients, team, and business records in PuffinPal.",
  icons: { icon: "/puffinpal-icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={siteFont.variable}>{children}</body>
    </html>
  );
}
