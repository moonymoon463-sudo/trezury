import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { PortfolioSummary, PortfolioPerformance } from "@/hooks/usePortfolioMonitoring";

interface PortfolioSummaryCardProps {
  summary: PortfolioSummary;
  performance: PortfolioPerformance;
}

export function PortfolioSummaryCard({ summary, performance }: PortfolioSummaryCardProps) {
  const isPositiveChange = performance.change24hPercent >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Portfolio Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Portfolio Value */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
          <p className="text-3xl font-bold text-foreground">
            ${summary.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center justify-center gap-1 mt-1">
            {isPositiveChange ? (
              <TrendingUp className="h-4 w-4 text-status-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-status-error" />
            )}
            <span className={`text-sm font-medium ${
              isPositiveChange ? 'text-status-success' : 'text-status-error'
            }`}>
              {isPositiveChange ? '+' : ''}{performance.change24hPercent.toFixed(2)}% (24h)
            </span>
          </div>
        </div>

        {/* Portfolio Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Wallet Balance</p>
            <p className="text-lg font-semibold text-foreground">
              ${summary.walletValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Lending Positions</p>
            <p className="text-lg font-semibold text-foreground">
              ${summary.suppliedValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Borrowed</p>
            <p className="text-lg font-semibold text-status-error">
              ${summary.borrowedValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Net Worth</p>
            <p className="text-lg font-semibold text-primary">
              ${summary.netValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Net APY */}
        <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Net APY</span>
          </div>
          <span className={`text-sm font-bold ${
            summary.netAPY >= 0 ? 'text-status-success' : 'text-status-error'
          }`}>
            {summary.netAPY >= 0 ? '+' : ''}{(summary.netAPY * 100).toFixed(2)}%
          </span>
        </div>

        {/* Available Borrowing Power */}
        {summary.availableBorrowUSD > 0 && (
          <div className="p-3 bg-surface-elevated rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available to Borrow</span>
              <span className="text-sm font-semibold text-primary">
                ${summary.availableBorrowUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}