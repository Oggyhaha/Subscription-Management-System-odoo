import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  isLoading = false,
  className,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-8 w-36" />
        <Skeleton className="mt-2 h-3 w-44" />
      </Card>
    );
  }

  return (
    <Card className={cn("transition-shadow hover:shadow-sm", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-paper-3 text-muted-foreground">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {value}
          </div>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center text-xs font-medium",
                trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}
            >
              {trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

