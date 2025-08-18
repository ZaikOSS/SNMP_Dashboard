"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { DeviceMetrics } from "@/types";

interface MetricsChartProps {
  data: DeviceMetrics[];
  dataKeys: (keyof Omit<DeviceMetrics, "timestamp">)[];
  title?: string;
}

const chartConfig = {
  dataIn: {
    label: "Data In (KB/s)",
    color: "hsl(var(--chart-1))",
  },
  dataOut: {
    label: "Data Out (KB/s)",
    color: "hsl(var(--chart-2))",
  },
  cpu: {
    label: "CPU (%)",
    color: "hsl(var(--chart-3))",
  },
  ram: {
    label: "RAM (%)",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const getFormatter = (key: keyof DeviceMetrics) => {
  switch (key) {
    case "dataIn":
    case "dataOut":
      return (value: number) => `${value.toFixed(2)} KB/s`;
    case "cpu":
    case "ram":
      return (value: number) => `${value.toFixed(2)} %`;
    default:
      return (value: number) => value.toString();
  }
};

export function MetricsChart({ data, dataKeys }: MetricsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No performance data available.
      </div>
    );
  }

  const filteredConfig = Object.fromEntries(
    Object.entries(chartConfig).filter(([key]) =>
      dataKeys.includes(key as keyof DeviceMetrics)
    )
  );

  const yAxisDomain =
    dataKeys.includes("cpu") || dataKeys.includes("ram")
      ? ["auto", "auto"]
      : ["auto", "auto"];

  return (
    <div className="h-[200px] w-full pt-4">
      <ChartContainer config={filteredConfig} className="h-full w-full">
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
          >
            <defs>
              {dataKeys.map((key) => (
                <linearGradient
                  key={String(key)}
                  id={`color${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${key})`}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              domain={yAxisDomain}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) =>
                    getFormatter(name as keyof DeviceMetrics)(value as number)
                  }
                  indicator="dot"
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {dataKeys.map((key) => (
              <Area
                key={String(key)}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                fillOpacity={1}
                fill={`url(#color${key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
