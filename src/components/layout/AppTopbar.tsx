"use client";

import * as React from "react";
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
  userName = "Demo User",
  userEmail = "user@brightloop.local",
}: AppTopbarProps) {
  const [sheetOpen, setSheetOpen] = React.useState(false);

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
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline-block font-medium text-foreground">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none text-foreground">{userName}</p>
                <p className="text-[11px] leading-none text-muted-foreground">{userEmail}</p>
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
            <DropdownMenuItem asChild>
              {/* Dev A can wire this form/action in Hour 2 */}
              <form action="/api/auth/logout" method="POST" className="w-full">
                <button
                  type="submit"
                  className="flex w-full items-center text-xs text-destructive"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

