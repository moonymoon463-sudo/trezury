import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLendingOperations, UserPosition } from "@/hooks/useLendingOperations";
import { useEffect } from "react";

export function UserPositions() {
  const { userPositions, healthFactor, fetchUserPositions } = useLendingOperations();

  useEffect(() => {
    fetchUserPositions();
  }, []);

  const formatAmount = (amount: number) => amount.toFixed(4);
  const getHealthStatus = (hf: number) => {
    if (hf > 2) return { label: "Healthy", variant: "default" as const };
    if (hf > 1.5) return { label: "Moderate", variant: "secondary" as const };
    if (hf > 1) return { label: "Risky", variant: "destructive" as const };
    return { label: "Critical", variant: "destructive" as const };
  };

  const healthStatus = getHealthStatus(healthFactor);
  const totalSupplied = userPositions.reduce((sum, pos) => sum + pos.suppliedAmount, 0);
  const totalBorrowed = userPositions.reduce((sum, pos) => sum + pos.borrowedAmount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Supplied</div>
            <div className="text-2xl font-bold text-foreground">${totalSupplied.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Borrowed</div>
            <div className="text-2xl font-bold text-foreground">${totalBorrowed.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Health Factor</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">{healthFactor.toFixed(2)}</span>
              <Badge variant={healthStatus.variant}>{healthStatus.label}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {userPositions.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Your Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userPositions.map((position) => (
                <div 
                  key={`${position.asset}-${position.chain}`}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium text-foreground">{position.asset}</div>
                      <div className="text-sm text-muted-foreground">{position.chain}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 text-right">
                    {position.suppliedAmount > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground">Supplied</div>
                        <div className="font-medium text-primary">
                          {formatAmount(position.suppliedAmount)} {position.asset}
                        </div>
                      </div>
                    )}
                    
                    {position.borrowedAmount > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground">Borrowed</div>
                        <div className="font-medium text-destructive">
                          {formatAmount(position.borrowedAmount)} {position.asset}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}