import * as React from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { getSession } from "@/server/auth/guards";

export interface DashboardShellProps {
  children: React.ReactNode;
  role: "admin" | "staff" | "customer";
}

export async function DashboardShell({ children, role }: DashboardShellProps) {
  const session = await getSession();
  const userName = session?.user?.name || (role === "admin" ? "Administrator" : role === "staff" ? "Staff Member" : "Customer");
  const userEmail = session?.user?.email || "";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop fixed sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        <AppSidebar role={role} className="w-full" />
      </div>

      {/* Main app container */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        <AppTopbar role={role} userName={userName} userEmail={userEmail} />
        <main className="flex-1 pb-12 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
