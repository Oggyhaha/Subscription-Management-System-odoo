"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatMoney } from "@/lib/money";

interface PlanDistributionItem {
  planName: string;
  count: number;
  mrr: number;
}

interface PlanDistributionChartProps {
  data: PlanDistributionItem[];
}

export function PlanDistributionChart({ data }: PlanDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-rule bg-card p-6 text-sm text-muted-foreground">
        No plan subscriber data available.
      </div>
    );
  }

  return (
    <div className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--rule))" opacity={0.6} />
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <YAxis
            type="category"
            dataKey="planName"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={90}
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
              name === "mrr" ? formatMoney(value) : value,
              name === "mrr" ? "Monthly Recurring Revenue (MRR)" : "Subscribers",
            ]}
          />
          <Bar
            dataKey="mrr"
            name="mrr"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

