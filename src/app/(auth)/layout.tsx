import * as React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const metadata = {
  title: "Authentication — Brightloop Software",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
      {/* Top Header */}
      <header className="flex h-16 items-center justify-between px-6 border-b border-rule/50">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs shadow-xs">
            B
          </div>
          <span className="text-base tracking-tight">Brightloop Software</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Container */}
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-rule/50 py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Brightloop Software. Secure subscription management system.
      </footer>
    </div>
  );
}

