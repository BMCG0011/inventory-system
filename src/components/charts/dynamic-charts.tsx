"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChartData = Record<string, string | number>;

interface ChartComponentProps {
  data: ChartData[];
  title?: string;
  description?: string;
  dataKey: string;
  nameKey: string;
  color?: string;
}

interface TimeRangeSelectorProps {
  timeRange: "week" | "month" | "year";
  setTimeRange: (range: "week" | "month" | "year") => void;
}

// Helper function for empty state
const EmptyState = () => (
  <div className="flex items-center justify-center h-full w-full">
    <p className="text-muted-foreground text-sm">No data available</p>
  </div>
);

// Chart configuration for shadcn
const chartConfig: ChartConfig = {
  count: {
    label: "Count",
    color: "#3b82f6",
  },
};

export function ChartBarDynamic({
  data,
  dataKey,
  nameKey,
  color = "#8884d8",
}: ChartComponentProps) {
  if (!data || data.length === 0) return <EmptyState />;

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={nameKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }} // Smaller font size
          angle={-60} // Steeper angle for better fit
          textAnchor="end"
          height={80} // Increased height for X-axis
          interval={0} // Show all labels (or set to 'auto' to skip some)
          tickFormatter={(value) => {
            // Convert value to string and handle null/undefined
            const strValue = String(value ?? "");

            // Truncate if length > 10, otherwise return as-is
            return strValue.length > 10
              ? `${strValue.substring(0, 10)}...`
              : strValue;
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
          width={30}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} fill={color} />
      </BarChart>
    </ChartContainer>
  );
}
// Dynamic Area Chart with Time Range Selector
export function ChartAreaDynamic({
  data,
  title,
  description,
  timeRange,
  setTimeRange,
}: ChartComponentProps & TimeRangeSelectorProps) {
  if (!data || data.length === 0) return <EmptyState />;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Tabs
          defaultValue={timeRange}
          onValueChange={(value: string) => {
            const isValidRange = (
              val: string,
            ): val is "week" | "month" | "year" =>
              ["week", "month", "year"].includes(val);

            const range: "week" | "month" | "year" = isValidRange(value)
              ? value
              : "week";
            setTimeRange(range);
          }}
          className="ml-auto"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                // Check if value is a string and matches YYYY-MM-DD format
                if (
                  typeof value !== "string" ||
                  !/^\d{4}-\d{2}-\d{2}$/.test(value)
                ) {
                  return "Invalid"; // Fallback for invalid input
                }

                const [year, month, day] = value.split("-");

                // Ensure year, month, and day are valid
                if (!year || !month || !day) {
                  return "Invalid"; // Fallback for malformed input
                }

                if (timeRange === "week") {
                  return day; // Return day (e.g., "25")
                }
                if (timeRange === "month") {
                  return `${month}/${day}`; // Return month/day (e.g., "09/25")
                }
                return `${month}/${year.slice(2)}`; // Return month/year (e.g., "09/25")
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={30}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              labelFormatter={(label) =>
                `Date: ${typeof label === "string" ? label : ""}`
              }
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              fill="url(#colorGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Dynamic Pie Chart
export function ChartPieDynamic({
  data,
  dataKey,
  nameKey,
}: ChartComponentProps) {
  if (!data || data.length === 0) return <EmptyState />;

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  return (
    <ChartContainer config={chartConfig} className="w-full h-[250px]">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey={dataKey}
          nameKey={nameKey}
          label={({ payload, percent = 0 }) =>
            `${String(payload?.[nameKey])}: ${typeof percent === "number" && !isNaN(percent) ? (percent * 100).toFixed(0) : "N/A"}%`
          }
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <ChartTooltip
          content={<ChartTooltipContent />}
          formatter={(value) => [value, "Items"]}
        />
      </PieChart>
    </ChartContainer>
  );
}
