"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface StatusBreakdownItem {
  status: string;
  count: number;
}

interface SubscriptionStatusChartProps {
  data: StatusBreakdownItem[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981",    // Emerald
  PAUSED: "#f59e0b",    // Amber
  QUOTATION: "#3b82f6", // Blue
  CONFIRMED: "#6366f1", // Indigo
  DRAFT: "#94a3b8",     // Slate
  CLOSED: "#ef4444",    // Rose
  CANCELLED: "#64748b", // Slate
};

const DEFAULT_COLOR = "#8b5cf6";

export function SubscriptionStatusChart({ data }: SubscriptionStatusChartProps) {
  if (!data || data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-rule bg-card p-6 text-sm text-muted-foreground">
        No active subscriptions to display.
      </div>
    );
  }

  const activeData = data.filter((d) => d.count > 0);
  const totalCount = activeData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--rule))",
              borderRadius: "0.5rem",
              fontSize: "12px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value: number, name: string) => [
              `${value} (${((value / totalCount) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }}
          />
          <Pie
            data={activeData}
            cx="50%"
            cy="46%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="count"
            nameKey="status"
          >
            {activeData.map((entry) => (
              <Cell
                key={`cell-${entry.status}`}
                fill={STATUS_COLORS[entry.status] || DEFAULT_COLOR}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

