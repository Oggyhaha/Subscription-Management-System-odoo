export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Brightloop Software
        </h1>
        <p className="text-base text-muted-foreground">
          Subscription Management System — Unified recurring billing, plans, and customer portal.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <a
            href="/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign In
          </a>
          <a
            href="/portal"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Customer Portal
          </a>
        </div>
      </div>
    </main>
  );
}
