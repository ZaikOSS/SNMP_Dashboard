
'use client';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { DeviceMetrics } from '@/types';

interface MetricsChartProps {
  data: DeviceMetrics[];
}

const chartConfig = {
  dataIn: {
    label: 'Data In (KB/s)',
    color: 'hsl(var(--chart-1))',
  },
  dataOut: {
    label: 'Data Out (KB/s)',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export function MetricsChart({ data }: MetricsChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No throughput data available.</div>;
  }
  
  return (
    <div className="h-[300px] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDataIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-dataIn)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-dataIn)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorDataOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-dataOut)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-dataOut)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip 
                content={<ChartTooltipContent 
                    formatter={(value, name) => `${(value as number).toFixed(2)} KB/s`}
                />} 
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="dataIn"
              stroke="var(--color-dataIn)"
              fillOpacity={1}
              fill="url(#colorDataIn)"
            />
            <Area
              type="monotone"
              dataKey="dataOut"
              stroke="var(--color-dataOut)"
              fillOpacity={1}
              fill="url(#colorDataOut)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
