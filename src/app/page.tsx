import Link from "next/link";
import { ArrowRight, ShieldCheck, Repeat, Receipt, Users } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
      {/* Hallmark Header */}
      <header className="flex h-16 items-center justify-between border-b border-rule px-6 md:px-12 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shadow-xs">
            B
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Brightloop Software
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Main Hallmark Hero */}
      <main className="flex-1 flex flex-col justify-center max-w-5xl mx-auto px-6 py-16 w-full">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper-3 px-3 py-1 text-xs text-muted-foreground font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Subscription Management Platform
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Subscription management for recurring revenue
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Centralize plans, customer subscriptions, automated recurring billing, invoices, and payment tracking for Brightloop Software.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              Enter platform
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Customer register
            </Link>
          </div>
        </div>

        {/* Quick Portal Access */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3 border-t border-rule pt-8">
          <Link
            href="/admin"
            className="group rounded-lg border border-rule bg-card p-5 transition-colors hover:border-primary/40 hover:bg-paper-3/50"
          >
            <div className="flex items-center gap-3 mb-2 text-foreground font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Administrator portal
            </div>
            <p className="text-xs text-muted-foreground">
              Complete plan configuration, taxes, discounts, staff accounts, audit logs, and revenue metrics.
            </p>
          </Link>

          <Link
            href="/staff"
            className="group rounded-lg border border-rule bg-card p-5 transition-colors hover:border-primary/40 hover:bg-paper-3/50"
          >
            <div className="flex items-center gap-3 mb-2 text-foreground font-semibold text-sm">
              <Users className="h-4 w-4 text-primary" />
              Staff operations
            </div>
            <p className="text-xs text-muted-foreground">
              Daily customer management, quotations, subscription lifecycle actions, and invoice preparation.
            </p>
          </Link>

          <Link
            href="/customer"
            className="group rounded-lg border border-rule bg-card p-5 transition-colors hover:border-primary/40 hover:bg-paper-3/50"
          >
            <div className="flex items-center gap-3 mb-2 text-foreground font-semibold text-sm">
              <Receipt className="h-4 w-4 text-primary" />
              Customer self-service
            </div>
            <p className="text-xs text-muted-foreground">
              Direct access to active subscriptions, renewal dates, invoices, and payment receipts.
            </p>
          </Link>
        </div>
      </main>

      <footer className="border-t border-rule px-6 py-6 text-center text-xs text-muted-foreground">
        Brightloop Software &middot; Built with Next.js, TypeScript, Tailwind &amp; shadcn/ui
      </footer>
    </div>
  );
}

