"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatMoney } from "@/lib/money";

interface RevenueTrendPoint {
  period: string;
  invoiced: number;
  collected: number;
}

interface RevenueTrendChartProps {
  data: RevenueTrendPoint[];
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-rule bg-card p-6 text-sm text-muted-foreground">
        No revenue activity recorded in the selected period.
      </div>
    );
  }

  return (
    <div className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          barGap={6}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--rule))" opacity={0.6} />
          <XAxis
            dataKey="period"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--rule))",
              borderRadius: "0.5rem",
              fontSize: "12px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value: number, name: string) => [
              formatMoney(value),
              name === "invoiced" ? "Invoiced Receivables" : "Cash Collected",
            ]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: "12px", fontSize: "12px" }}
            formatter={(value) => (value === "invoiced" ? "Invoiced" : "Cash Collected")}
          />
          <Bar
            dataKey="invoiced"
            name="invoiced"
            fill="hsl(var(--primary) / 0.35)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="collected"
            name="collected"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

