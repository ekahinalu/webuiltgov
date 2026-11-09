import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WeBuiltGov", template: "%s · WeBuiltGov" },
  description: "Search government opportunities synced from public sources.",
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
