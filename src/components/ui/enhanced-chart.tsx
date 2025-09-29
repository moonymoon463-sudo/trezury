import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartDataPoint {
  time: string;
  value: number;
  volume?: number;
}

interface EnhancedChartProps {
  data: ChartDataPoint[];
  title: string;
  description?: string;
  type?: 'line' | 'area';
  color?: string;
  showVolume?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
  formatTime?: (time: string) => string;
}

export const EnhancedChart = ({
  data,
  title,
  description,
  type = 'line',
  color = 'hsl(var(--primary))',
  showVolume = false,
  height = 300,
  formatValue = (value) => `$${value.toLocaleString()}`,
  formatTime = (time) => new Date(time).toLocaleDateString()
}: EnhancedChartProps) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-1">{formatTime(label)}</p>
          <p className="text-sm font-medium">
            Price: <span className="text-primary">{formatValue(payload[0].value)}</span>
          </p>
          {showVolume && payload[1] && (
            <p className="text-sm">
              Volume: <span className="text-muted-foreground">{payload[1].value.toLocaleString()}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const Chart = type === 'area' ? AreaChart : LineChart;
  const ChartElement = type === 'area' ? Area : Line;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <Chart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <XAxis 
              dataKey="time" 
              tickFormatter={formatTime}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tickFormatter={(value) => formatValue(value)}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            {type === 'area' ? (
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`${color}20`}
                dot={false}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            )}
          </Chart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default EnhancedChart;