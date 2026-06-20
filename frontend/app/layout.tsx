import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuditLogProvider } from "@/components/audit-log-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oodo ERP",
  description: "Mock JWT auth frontend for Oodo ERP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuditLogProvider>{children}</AuditLogProvider>
      </body>
    </html>
  );
}
