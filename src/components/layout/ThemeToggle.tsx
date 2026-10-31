"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [mode, setMode] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const saved = localStorage.getItem("sms-theme-mode") as "light" | "dark" | null;
    if (saved) {
      setMode(saved);
      document.documentElement.dataset.mode = saved;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
      document.documentElement.dataset.mode = "dark";
    }
  }, []);

  const toggle = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    document.documentElement.dataset.mode = next;
    localStorage.setItem("sms-theme-mode", next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
    >
      {mode === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}

