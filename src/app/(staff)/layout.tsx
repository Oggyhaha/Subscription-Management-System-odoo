import * as React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata = {
  title: "Staff Operations — Brightloop Subscription Management",
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell role="staff">{children}</DashboardShell>;
}

