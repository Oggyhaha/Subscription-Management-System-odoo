import * as React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata = {
  title: "Customer Portal — Brightloop Subscription Management",
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell role="customer">{children}</DashboardShell>;
}

