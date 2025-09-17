import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Shield, Copy, CheckCircle } from "lucide-react";
import { useLending } from "@/hooks/useLending";
import { Chain, Token, CHAIN_CONFIGS, LOCK_TERMS } from "@/types/lending";
import { LendingService } from "@/services/lendingService";
import { LendingWalletService } from "@/services/lendingWalletService";
import { useToast } from "@/hooks/use-toast";

export function LendingDeposit() {
  const { createLock, calculateAPY, loading } = useLending();
  const { toast } = useToast();
  const [selectedChain, setSelectedChain] = useState<Chain>('ethereum');
  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [amount, setAmount] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(30);
  const [autocompound, setAutocompound] = useState(false);
  const [currentAPY, setCurrentAPY] = useState(0);
  const [showDepositInfo, setShowDepositInfo] = useState(false);
  const [createdLock, setCreatedLock] = useState<any>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

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

  // Reset token when chain changes and check support
  useEffect(() => {
    const supportedTokens = LendingWalletService.getSupportedTokens(selectedChain);
    if (supportedTokens.length > 0 && !supportedTokens.includes(selectedToken)) {
      setSelectedToken(supportedTokens[0]);
    }
  }, [selectedChain, selectedToken]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    // Check if chain/token combination is supported
    if (!LendingWalletService.isSupported(selectedChain, selectedToken)) {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: `${selectedToken} lending on ${selectedChain} is not yet available`
      });
      return;
    }

    try {
      const newLock = await createLock(
        selectedChain,
        selectedToken,
        parseFloat(amount),
        selectedTerm,
        autocompound
      );
      
      if (newLock) {
        setCreatedLock(newLock);
        setShowDepositInfo(true);
        // Don't reset form - keep values for reference
      }
    } catch (error) {
      // Error handled in hook
    }
  };

  const resetForm = () => {
    setAmount('');
    setAutocompound(false);
    setShowDepositInfo(false);
    setCreatedLock(null);
  };

  // Get supported tokens for selected chain
  const supportedTokens = LendingWalletService.getSupportedTokens(selectedChain);
  const availableTokenConfigs = selectedChainConfig.tokens.filter(
    token => supportedTokens.includes(token.symbol)
  );

  // Show deposit instructions if lock was created
  if (showDepositInfo && createdLock) {
    const depositInfo = LendingWalletService.generateDepositInstructions(
      selectedChain,
      selectedToken,
      parseFloat(amount),
      createdLock.id
    );

    return (
      <Card className="w-full max-w-2xl mx-auto bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <CheckCircle className="h-5 w-5 text-primary" />
            Lock Created - Send Deposit
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Send your {selectedToken} to activate your lending lock
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-surface-elevated rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-card-foreground">Deposit Address:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(depositInfo.depositAddress)}
                className="ml-2"
              >
                {copiedAddress ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="font-mono text-sm bg-card p-3 rounded border border-border break-all text-card-foreground">
              {depositInfo.depositAddress}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Amount:</span>
                <p className="font-medium text-card-foreground">{depositInfo.amount} {depositInfo.token}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Network:</span>
                <p className="font-medium capitalize text-card-foreground">{depositInfo.chain}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Lock ID:</span>
                <p className="font-mono text-xs text-card-foreground">{depositInfo.memo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">APY:</span>
                <p className="font-medium text-primary">{LendingService.formatAPY(currentAPY)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-card-foreground">Deposit Instructions:</h4>
            <ol className="text-sm space-y-2">
              {depositInfo.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-muted-foreground font-mono text-xs mt-0.5">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span className="text-muted-foreground">{instruction.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-card border border-primary/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-primary">Important</p>
                <ul className="space-y-1 text-card-foreground">
                  <li>• Double-check the deposit address and network</li>
                  <li>• Include the Lock ID as memo/reference</li>
                  <li>• Your lock activates after deposit confirmation</li>
                  <li>• Keep transaction hash for your records</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={resetForm} 
              variant="outline" 
              className="flex-1"
            >
              Create Another Lock
            </Button>
            <Button 
              onClick={() => setShowDepositInfo(false)} 
              className="flex-1"
            >
              View My Locks
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

    return (
      <Card className="w-full max-w-2xl mx-auto bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            Stablecoin Lending
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Lock stablecoins to earn yield. No lock = 0% APY.
          </CardDescription>
        </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chain Selection */}
          <div className="space-y-2">
            <Label htmlFor="chain" className="text-foreground">Blockchain</Label>
            <Select value={selectedChain} onValueChange={(value: Chain) => setSelectedChain(value)}>
              <SelectTrigger className="bg-surface-elevated border-border text-foreground">
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent className="bg-surface-overlay border-border">
                {Object.entries(CHAIN_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-foreground focus:bg-surface-elevated focus:text-foreground">
                    {config.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Token Selection */}
          <div className="space-y-2">
            <Label htmlFor="token" className="text-foreground">Stablecoin</Label>
            <Select value={selectedToken} onValueChange={(value: Token) => setSelectedToken(value)}>
              <SelectTrigger className="bg-surface-elevated border-border text-foreground">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent className="bg-surface-overlay border-border">
                {availableTokenConfigs.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol} className="text-foreground focus:bg-surface-elevated focus:text-foreground">
                    {token.symbol}
                    {!LendingWalletService.isSupported(selectedChain, token.symbol) && 
                      <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="bg-surface-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Lock Term Selection */}
          <div className="space-y-3">
            <Label className="text-foreground">Lock Term</Label>
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
            <div className="bg-surface-elevated rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Current APY</span>
                <Badge variant="secondary" className="text-lg font-bold bg-primary text-primary-foreground">
                  {LendingService.formatAPY(currentAPY)}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Maturity Date</span>
                <span className="text-sm text-foreground">
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
            <Label htmlFor="autocompound" className="text-sm text-foreground">
              Auto-compound at maturity (relock at new APY)
            </Label>
          </div>

          {/* Risk Disclosure */}
          <div className="bg-card border border-primary/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-primary">
                  Important Disclosures
                </p>
                <ul className="space-y-1 text-card-foreground">
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
            className="w-full font-bold" 
            size="lg"
            disabled={!amount || parseFloat(amount) <= 0 || loading || !LendingWalletService.isSupported(selectedChain, selectedToken)}
          >
            {loading ? (
              "Creating Lock..."
            ) : !LendingWalletService.isSupported(selectedChain, selectedToken) ? (
              `${selectedToken} on ${selectedChain} Coming Soon`
            ) : (
              `Create Lock: ${amount || '0'} ${selectedToken} for ${selectedTermConfig?.label || ''}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
