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
        const history = await goldPriceService.getHistoricalPrices(timeframe);
        
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
      } catch (error) {
        console.error('Failed to load chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    generateChartData();
  }, [timeframe]);

  // Add current price to chart data
  useEffect(() => {
    if (currentPrice && chartData.length > 0) {
      const now = new Date();
      let timeLabel: string;
      
      switch (timeframe) {
        case '1h':
        case '24h':
          timeLabel = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          break;
        case '7d':
          timeLabel = now.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit'
          });
          break;
        case '30d':
        case '3m':
          timeLabel = now.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          break;
        default:
          timeLabel = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
      }

      setChartData(prev => {
        const updated = [...prev];
        const lastPoint = updated[updated.length - 1];
        
        // Update last point or add new one
        if (lastPoint && lastPoint.time === timeLabel) {
          lastPoint.price = currentPrice.usd_per_oz;
        } else {
          updated.push({
            time: timeLabel,
            price: currentPrice.usd_per_oz,
            timestamp: now.getTime()
          });
        }
        
        // Keep reasonable number of points based on timeframe
        let maxPoints: number;
        switch (timeframe) {
          case '1h':
            maxPoints = 60;
            break;
          case '24h':
            maxPoints = 144;
            break;
          case '7d':
            maxPoints = 168;
            break;
          case '30d':
            maxPoints = 180;
            break;
          case '3m':
            maxPoints = 90;
            break;
          default:
            maxPoints = 144;
        }
        
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

      <div className="h-64 relative">
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
                  <stop offset="5%" stopColor="#f9b006" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f9b006" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['dataMin - 5', 'dataMax + 5']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                width={60}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
                formatter={formatTooltip}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              {/* Reference line for current price */}
              {currentPrice && (
                <ReferenceLine 
                  y={currentPrice.usd_per_oz} 
                  stroke="#f9b006" 
                  strokeDasharray="2 2" 
                  strokeOpacity={0.5}
                />
              )}
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#f9b006" 
                strokeWidth={2}
                dot={false}
                activeDot={{ 
                  r: 5, 
                  fill: '#f9b006', 
                  stroke: '#fff', 
                  strokeWidth: 2 
                }}
                fill="url(#priceGradient)"
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
