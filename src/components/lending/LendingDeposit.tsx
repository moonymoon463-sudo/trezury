import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Shield } from "lucide-react";
import { useLending } from "@/hooks/useLending";
import { Chain, Token, CHAIN_CONFIGS, LOCK_TERMS } from "@/types/lending";
import { LendingService } from "@/services/lendingService";

export function LendingDeposit() {
  const { createLock, calculateAPY, loading } = useLending();
  const [selectedChain, setSelectedChain] = useState<Chain>('ethereum');
  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [amount, setAmount] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(30);
  const [autocompound, setAutocompound] = useState(false);
  const [currentAPY, setCurrentAPY] = useState(0);

  const selectedChainConfig = CHAIN_CONFIGS[selectedChain];
  const selectedTermConfig = LOCK_TERMS.find(t => t.days === selectedTerm);
  const maturityDate = selectedTermConfig 
    ? LendingService.getMaturityDate(new Date(), selectedTerm)
    : new Date();

  // Update APY when chain, token, or term changes
  useEffect(() => {
    const updateAPY = async () => {
      if (selectedChain && selectedToken && selectedTerm) {
        const apy = await calculateAPY(selectedChain, selectedToken, selectedTerm);
        setCurrentAPY(apy);
      }
    };
    updateAPY();
  }, [selectedChain, selectedToken, selectedTerm, calculateAPY]);

  // Reset token when chain changes
  useEffect(() => {
    const availableTokens = selectedChainConfig.tokens.map(t => t.symbol);
    if (!availableTokens.includes(selectedToken)) {
      setSelectedToken(availableTokens[0]);
    }
  }, [selectedChain, selectedChainConfig, selectedToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    try {
      await createLock(
        selectedChain,
        selectedToken,
        parseFloat(amount),
        selectedTerm,
        autocompound
      );
      
      // Reset form
      setAmount('');
      setAutocompound(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Stablecoin Lending
        </CardTitle>
        <CardDescription>
          Lock stablecoins to earn yield. No lock = 0% APY.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chain Selection */}
          <div className="space-y-2">
            <Label htmlFor="chain">Blockchain</Label>
            <Select value={selectedChain} onValueChange={(value: Chain) => setSelectedChain(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHAIN_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Token Selection */}
          <div className="space-y-2">
            <Label htmlFor="token">Stablecoin</Label>
            <Select value={selectedToken} onValueChange={(value: Token) => setSelectedToken(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {selectedChainConfig.tokens.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Lock Term Selection */}
          <div className="space-y-3">
            <Label>Lock Term</Label>
            <div className="grid grid-cols-2 gap-2">
              {LOCK_TERMS.map((term) => (
                <Button
                  key={term.days}
                  type="button"
                  variant={selectedTerm === term.days ? "default" : "outline"}
                  className="flex flex-col items-center p-4 h-auto"
                  onClick={() => setSelectedTerm(term.days)}
                >
                  <span className="font-medium">{term.label}</span>
                  <span className="text-sm opacity-70">
                    {term.apyMin}% - {term.apyMax}% APY
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Current APY Display */}
          {selectedTermConfig && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current APY</span>
                <Badge variant="secondary" className="text-lg font-bold">
                  {LendingService.formatAPY(currentAPY)}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Maturity Date</span>
                <span className="text-sm">
                  {maturityDate.toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {/* Auto-compound Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="autocompound"
              checked={autocompound}
              onCheckedChange={(checked) => setAutocompound(checked === true)}
            />
            <Label htmlFor="autocompound" className="text-sm">
              Auto-compound at maturity (relock at new APY)
            </Label>
          </div>

          {/* Risk Disclosure */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Important Disclosures
                </p>
                <ul className="space-y-1 text-amber-700 dark:text-amber-300">
                  <li>• Early exit returns principal only; all interest is forfeited</li>
                  <li>• APY varies with pool utilization and safety reserves</li>
                  <li>• Real yield from borrower interest; capital at risk</li>
                  <li>• Not FDIC insured; smart contract risk applies</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={!amount || parseFloat(amount) <= 0 || loading}
          >
            {loading ? (
              "Creating Lock..."
            ) : (
              `Lock ${amount || '0'} ${selectedToken} for ${selectedTermConfig?.label || ''}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}