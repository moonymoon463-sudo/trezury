import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useTrzryReserves } from "@/hooks/useTrzryReserves";

const TrzryReserveChart = () => {
  const { historicalData, loading } = useTrzryReserves();

  const formatTooltip = (value: number) => {
    return [`$${value.toLocaleString()}`, 'Reserve Value'];
  };

  const formatXAxisLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-[#2C2C2E] rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-base font-bold">Reserve Growth (30 Days)</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full"></div>
          <span className="text-gray-400 text-xs">Total Value</span>
        </div>
      </div>

      <div className="h-48">
        {loading ? (
          <div className="h-full bg-[#1A1A1A] rounded-lg flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading reserve data...</p>
          </div>
        ) : historicalData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData}>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                interval="preserveStartEnd"
                tickFormatter={formatXAxisLabel}
              />
              <YAxis 
                domain={['dataMin - 10000', 'dataMax + 10000']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                width={80}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #2C2C2E',
                  borderRadius: '8px',
                  color: '#FFFFFF'
                }}
                formatter={formatTooltip}
                labelFormatter={(label) => `Date: ${formatXAxisLabel(label)}`}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#1A1A1A' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full bg-[#1A1A1A] rounded-lg flex items-center justify-center">
            <p className="text-gray-400 text-sm">No reserve data available</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-gray-400 text-xs">30d Growth</p>
          <p className="text-green-400 font-bold text-sm">+8.5%</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs">Avg Daily</p>
          <p className="text-white font-bold text-sm">+0.28%</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs">All Time High</p>
          <p className="text-white font-bold text-sm">
            ${historicalData.length > 0 ? Math.max(...historicalData.map(d => d.value)).toLocaleString() : '0'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrzryReserveChart;