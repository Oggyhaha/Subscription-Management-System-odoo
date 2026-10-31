"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { StatusBadge } from "@/components/shared/StatusBadge";

export interface AppTopbarProps {
  role: "admin" | "staff" | "customer";
  userName?: string;
  userEmail?: string;
}

export function AppTopbar({
  role,
  userName = "User",
  userEmail = "",
}: AppTopbarProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Active user details
  const [user, setUser] = React.useState({
    name: userName,
    email: userEmail,
  });

  // Client-side session sync if defaults were initially passed
  React.useEffect(() => {
    if (userName && userName !== "User" && userName !== "Demo User") {
      setUser({ name: userName, email: userEmail });
      return;
    }

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setUser({
            name: data.user.name || "User",
            email: data.user.email || "",
          });
        }
      })
      .catch(() => {});
  }, [userName, userEmail]);

  // Robust client-side sign out handler
  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Fallback regardless of network
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const initial = user.name.charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-rule bg-card/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 lg:hidden border-rule"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <AppSidebar role={role} onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Current workspace badge */}
        <div className="flex items-center gap-2">
          <StatusBadge status={role} />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative h-8 gap-2 rounded-full pl-2 pr-3 text-xs"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-paper-3 text-foreground font-semibold text-[10px]">
                {initial}
              </div>
              <span className="hidden md:inline-block font-medium text-foreground max-w-[140px] truncate">
                {user.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none text-foreground truncate">{user.name}</p>
                <p className="text-[11px] leading-none text-muted-foreground truncate">{user.email || "Signed in"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={`/${role}/settings`} className="cursor-pointer text-xs">
                <UserIcon className="mr-2 h-3.5 w-3.5" />
                Account settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
