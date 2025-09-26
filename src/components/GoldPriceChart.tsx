import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { goldPriceService } from "@/services/goldPrice";
import { TrendingUp, TrendingDown } from "lucide-react";

interface ChartData {
  time: string;
  price: number;
  timestamp: number;
}

const GoldPriceChart = () => {
  const { price: currentPrice } = useGoldPrice();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | '30d' | '3m'>('24h');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const generateChartData = async () => {
      try {
        setLoading(true);
        console.log(`🎯 Chart requesting data for timeframe: ${timeframe}`);
        
        // Add timeout to prevent chart from hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Chart data request timeout')), 15000); // 15 second timeout
        });
        
        const dataPromise = goldPriceService.getHistoricalPrices(timeframe);
        const history = await Promise.race([dataPromise, timeoutPromise]);
        
        console.log(`📊 Chart received ${history.length} data points`);
        
        const formattedData: ChartData[] = history.map(point => {
          const date = new Date(point.timestamp);
          let timeLabel: string;
          
          switch (timeframe) {
            case '1h':
              timeLabel = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              break;
            case '24h':
              timeLabel = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              break;
            case '7d':
              timeLabel = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit'
              });
              break;
            case '30d':
              timeLabel = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
              break;
            case '3m':
              timeLabel = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
              break;
            default:
              timeLabel = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
          }
          
          return {
            time: timeLabel,
            price: point.price,
            timestamp: date.getTime()
          };
        });

        setChartData(formattedData);
        console.log(`✅ Chart data updated with ${formattedData.length} points`);
      } catch (error) {
        console.error('❌ Failed to load chart data:', error);
        // Set empty data so chart shows "No chart data available" instead of staying in loading
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    generateChartData();
  }, [timeframe]);

  // Removed client-side merging of current price into chart series to avoid synthetic points


  const formatPrice = (value: number) => `$${value.toFixed(2)}`;

  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-foreground text-base font-bold leading-tight tracking-[-0.015em]">
          Gold Price Chart
        </h3>
        <div className="flex bg-surface-elevated rounded-lg p-0.5 gap-0.5">
          {[
            { key: '1h', label: '1H' },
            { key: '24h', label: '1D' },
            { key: '7d', label: '7D' },
            { key: '30d', label: '1M' },
            { key: '3m', label: '3M' }
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                timeframe === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
              }`}
              onClick={() => setTimeframe(key as '1h' | '24h' | '7d' | '30d' | '3m')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      {currentPrice && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-xl font-bold">
                ${currentPrice.usd_per_oz.toFixed(2)}
              </p>
              <p className="text-muted-foreground text-xs">USD per troy ounce</p>
            </div>
            <div className="flex items-center gap-1">
              {currentPrice.change_percent_24h >= 0 ? (
                <TrendingUp size={16} className="text-green-500" />
              ) : (
                <TrendingDown size={16} className="text-red-500" />
              )}
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  currentPrice.change_percent_24h >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {currentPrice.change_percent_24h >= 0 ? '+' : ''}
                  {currentPrice.change_percent_24h.toFixed(2)}%
                </p>
                <p className={`text-xs ${
                  currentPrice.change_24h >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {currentPrice.change_24h >= 0 ? '+' : ''}${currentPrice.change_24h.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-32 relative">
        {loading ? (
          <div className="h-full bg-surface-elevated rounded-lg flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <p className="text-muted-foreground text-sm">Loading chart data...</p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-primary))" stopOpacity={0.3}/>
                  <stop offset="50%" stopColor="hsl(var(--chart-primary))" stopOpacity={0.1}/>
                  <stop offset="100%" stopColor="hsl(var(--chart-primary))" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
                height={25}
              />
              <YAxis 
                domain={['dataMin', 'dataMax']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                width={50}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                  fontSize: '13px'
                }}
                formatter={(value: number, name: string) => [
                  `$${value.toFixed(2)}`,
                  'Gold Price'
                ]}
                labelStyle={{ 
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '12px',
                  marginBottom: '4px'
                }}
                cursor={{ 
                  stroke: 'hsl(var(--chart-primary))', 
                  strokeWidth: 1,
                  strokeOpacity: 0.5,
                  strokeDasharray: '4 4'
                }}
              />
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" strokeOpacity="0.1"/>
                </pattern>
              </defs>
              {/* Reference line for current price */}
              {currentPrice && (
                <ReferenceLine 
                  y={currentPrice.usd_per_oz} 
                  stroke="hsl(var(--chart-primary))" 
                  strokeDasharray="3 3" 
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                />
              )}
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="hsl(var(--chart-primary))" 
                strokeWidth={2.5}
                dot={false}
                activeDot={{ 
                  r: 6, 
                  fill: 'hsl(var(--chart-primary))', 
                  stroke: 'hsl(var(--background))', 
                  strokeWidth: 3,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
                fill="url(#priceGradient)"
                fillOpacity={1}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full bg-surface-elevated rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No chart data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoldPriceChart;
