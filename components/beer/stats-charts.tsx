"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BeerEntry } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

const COLORS = ["#f97316", "#fb923c", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6"];

interface StatsChartsProps {
  entries: BeerEntry[];
}

export function StatsCharts({ entries }: StatsChartsProps) {
  // Beers per day
  const perDay: Record<string, number> = {};
  for (const e of entries) {
    const key = formatDateShort(e.created_at);
    perDay[key] = (perDay[key] ?? 0) + e.amount;
  }
  const perDayData = Object.entries(perDay)
    .map(([date, count]) => ({ date, count }))
    .slice(-14);

  // Beer styles
  const styles: Record<string, number> = {};
  for (const e of entries) {
    if (e.style) styles[e.style] = (styles[e.style] ?? 0) + e.amount;
  }
  const styleData = Object.entries(styles)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Breweries
  const breweries: Record<string, number> = {};
  for (const e of entries) {
    if (e.brewery) breweries[e.brewery] = (breweries[e.brewery] ?? 0) + e.amount;
  }
  const breweryData = Object.entries(breweries)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Beers per day */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-4">
          Beers Per Day (last 14 days)
        </h3>
        {perDayData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perDayData} margin={{ left: -20 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} name="Beers" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[var(--muted-foreground)] text-sm text-center py-8">
            No data yet
          </p>
        )}
      </div>

      {/* Beer styles */}
      {styleData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-4">
            Beer Styles
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={styleData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {styleData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "var(--foreground)", fontSize: "12px" }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top breweries */}
      {breweryData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-4">
            Top Breweries
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={breweryData}
              layout="vertical"
              margin={{ left: 0, right: 20 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill="#fb923c" radius={[0, 4, 4, 0]} name="Beers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
