import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { goldPriceService } from "@/services/goldPrice";

interface ChartData {
  time: string;
  price: number;
}

const GoldPriceChart = () => {
  const { price: currentPrice } = useGoldPrice();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeframe, setTimeframe] = useState<'24h' | '7d'>('24h');

  useEffect(() => {
    const generateChartData = async () => {
      try {
        const days = timeframe === '24h' ? 1 : 7;
        const history = await goldPriceService.getHistoricalPrices(days);
        
        const formattedData: ChartData[] = history.map(point => ({
          time: timeframe === '24h' 
            ? new Date(point.timestamp).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            : new Date(point.timestamp).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              }),
          price: point.price
        }));

        setChartData(formattedData);
      } catch (error) {
        console.error('Failed to load chart data:', error);
      }
    };

    generateChartData();
  }, [timeframe]);

  // Add current price to chart data
  useEffect(() => {
    if (currentPrice && chartData.length > 0) {
      const now = new Date();
      const timeLabel = timeframe === '24h' 
        ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      setChartData(prev => {
        const updated = [...prev];
        const lastPoint = updated[updated.length - 1];
        
        // Update last point or add new one
        if (lastPoint && lastPoint.time === timeLabel) {
          lastPoint.price = currentPrice.usd_per_oz;
        } else {
          updated.push({
            time: timeLabel,
            price: currentPrice.usd_per_oz
          });
        }
        
        // Keep only last 24 points for 24h view, 7 for 7d view
        const maxPoints = timeframe === '24h' ? 24 : 7;
        if (updated.length > maxPoints) {
          return updated.slice(-maxPoints);
        }
        
        return updated;
      });
    }
  }, [currentPrice, timeframe, chartData.length]);

  const formatTooltip = (value: number) => {
    return [`$${value.toFixed(2)}`, 'Gold Price'];
  };

  return (
    <div className="bg-[#2C2C2E] rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-foreground text-lg font-bold leading-tight tracking-[-0.015em]">
          Gold Price Chart
        </h3>
        <div className="flex bg-[#1A1A1A] rounded-lg p-1">
          <button 
            className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
              timeframe === '24h' 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTimeframe('24h')}
          >
            24h
          </button>
          <button 
            className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
              timeframe === '7d' 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTimeframe('7d')}
          >
            7d
          </button>
        </div>
      </div>
      
      {currentPrice && (
        <div className="mb-4">
          <p className="text-foreground text-2xl font-bold">
            ${currentPrice.usd_per_oz.toFixed(2)}
          </p>
          <p className={`text-sm ${
            currentPrice.change_percent_24h >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {currentPrice.change_percent_24h >= 0 ? '+' : ''}
            {currentPrice.change_percent_24h.toFixed(2)}% (${currentPrice.change_24h.toFixed(2)})
          </p>
        </div>
      )}

      <div className="h-32">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['dataMin - 10', 'dataMax + 10']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                width={60}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #2C2C2E',
                  borderRadius: '8px',
                  color: '#FFFFFF'
                }}
                formatter={formatTooltip}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#f9b006" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#f9b006' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full bg-[#1A1A1A] rounded-lg flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading chart data...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoldPriceChart;
