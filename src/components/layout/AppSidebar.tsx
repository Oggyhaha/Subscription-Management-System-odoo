"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  CalendarDays,
  Users,
  UserCheck,
  FileText,
  FileSpreadsheet,
  Repeat,
  Receipt,
  CreditCard,
  Percent,
  Calculator,
  BarChart3,
  History,
  Settings,
  AlertTriangle,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavGroup {
  groupTitle?: string;
  items: NavItem[];
}

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "Overview",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Reports & analytics", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    groupTitle: "Sales & billing",
    items: [
      { title: "Subscriptions", href: "/admin/subscriptions", icon: Repeat },
      { title: "Quotations", href: "/admin/quotations", icon: FileSpreadsheet },
      { title: "Quotation templates", href: "/admin/quotation-templates", icon: FileText },
      { title: "Invoices", href: "/admin/invoices", icon: Receipt },
      { title: "Payments", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    groupTitle: "Catalog & pricing",
    items: [
      { title: "Products", href: "/admin/products", icon: Package },
      { title: "Product variants", href: "/admin/products/variants", icon: Layers },
      { title: "Subscription plans", href: "/admin/plans", icon: CalendarDays },
      { title: "Tax rules", href: "/admin/taxes", icon: Calculator },
      { title: "Discounts", href: "/admin/discounts", icon: Percent },
    ],
  },
  {
    groupTitle: "People & operations",
    items: [
      { title: "Customers", href: "/admin/customers", icon: Users },
      { title: "Staff members", href: "/admin/staff", icon: UserCheck },
      { title: "Audit log", href: "/admin/audit-logs", icon: History },
      { title: "System settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export const STAFF_NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "Operations",
    items: [
      { title: "Operations dashboard", href: "/staff", icon: LayoutDashboard },
      { title: "Customers", href: "/staff/customers", icon: Users },
      { title: "Quotations", href: "/staff/quotations", icon: FileSpreadsheet },
      { title: "Subscriptions", href: "/staff/subscriptions", icon: Repeat },
      { title: "Invoices", href: "/staff/invoices", icon: Receipt },
      { title: "Payments", href: "/staff/payments", icon: CreditCard },
      { title: "Overdue invoices", href: "/staff/overdue", icon: AlertTriangle },
    ],
  },
];

export const CUSTOMER_NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "Portal",
    items: [
      { title: "Portal overview", href: "/customer", icon: LayoutDashboard },
      { title: "My subscriptions", href: "/customer/subscriptions", icon: Repeat },
      { title: "My invoices", href: "/customer/invoices", icon: Receipt },
      { title: "Payment history", href: "/customer/payments", icon: CreditCard },
      { title: "Account settings", href: "/customer/settings", icon: Settings },
    ],
  },
];

export interface AppSidebarProps {
  role: "admin" | "staff" | "customer";
  onNavigate?: () => void;
  className?: string;
}

export function AppSidebar({ role, onNavigate, className }: AppSidebarProps) {
  const pathname = usePathname();

  const navGroups =
    role === "admin"
      ? ADMIN_NAV_GROUPS
      : role === "staff"
      ? STAFF_NAV_GROUPS
      : CUSTOMER_NAV_GROUPS;

  const roleLabel =
    role === "admin"
      ? "Administrator"
      : role === "staff"
      ? "Operations staff"
      : "Customer portal";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-rule bg-card text-card-foreground",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center border-b border-rule px-5">
        <Link
          href={`/${role}`}
          className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground"
          onClick={onNavigate}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs shadow-xs">
            B
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">Brightloop</span>
            <span className="text-[10px] text-muted-foreground font-normal mt-0.5">
              {roleLabel}
            </span>
          </div>
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {group.groupTitle && (
              <div className="px-2 pb-1.5 text-xs font-medium text-muted-foreground select-none">
                {group.groupTitle}
              </div>
            )}
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${role}` && pathname?.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2 text-xs font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-paper-3 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-paper-3 px-1.5 py-0.2 text-[10px] font-medium text-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="border-t border-rule p-3 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Brightloop v1.0</span>
        <span className="font-mono text-[10px]">odoo-sms</span>
      </div>
    </aside>
  );
}

