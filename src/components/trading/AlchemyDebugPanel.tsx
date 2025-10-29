/**
 * Debug panel for Alchemy authentication status
 * Shows detailed signer status for development/troubleshooting
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAccount, useSignerStatus, useUser } from '@account-kit/react';
import { ChevronDown, ChevronUp, Bug } from 'lucide-react';

export function AlchemyDebugPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { address } = useAccount({ type: "LightAccount" });
  const signerStatus = useSignerStatus();
  const user = useUser();

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 bg-background/95 backdrop-blur">
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            <span className="text-xs font-semibold">Alchemy Debug</span>
          </div>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>

        {isExpanded && (
          <div className="mt-3 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={signerStatus.isConnected ? 'text-green-500' : 'text-yellow-500'}>
                {signerStatus.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connected:</span>
              <span>{signerStatus.isConnected ? '✓' : '✗'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address:</span>
              <span className="truncate ml-2">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User:</span>
              <span>{user?.email || user?.userId?.slice(0, 8) || 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Key:</span>
              <span>{import.meta.env.VITE_ALCHEMY_API_KEY ? 'Set' : 'Demo'}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
