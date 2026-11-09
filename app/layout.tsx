import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WeBuiltGov", template: "%s · WeBuiltGov" },
  description: "A workspace for one organization to follow a Grants.gov funding opportunity from search through recorded payments.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
