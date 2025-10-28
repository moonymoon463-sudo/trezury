import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Network } from 'lucide-react';

interface NetworkSwitcherProps {
  chainId: number;
  onChainChange: (chainId: number) => void;
}

const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', color: 'bg-blue-500' },
  { id: 42161, name: 'Arbitrum', color: 'bg-blue-600' },
  { id: 10, name: 'Optimism', color: 'bg-red-500' },
  { id: 1, name: 'Ethereum', color: 'bg-gray-500' }
];

export const NetworkSwitcher = ({ chainId, onChainChange }: NetworkSwitcherProps) => {
  const currentChain = SUPPORTED_CHAINS.find(c => c.id === chainId);

  return (
    <div className="flex items-center gap-2">
      <Network className="h-4 w-4 text-muted-foreground" />
      <Select value={chainId.toString()} onValueChange={(val) => onChainChange(parseInt(val))}>
        <SelectTrigger className="w-[140px] h-8">
          <div className="flex items-center gap-2">
            {currentChain && (
              <div className={`h-2 w-2 rounded-full ${currentChain.color}`} />
            )}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_CHAINS.map(chain => (
            <SelectItem key={chain.id} value={chain.id.toString()}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${chain.color}`} />
                <span>{chain.name}</span>
                {chain.id === 8453 && (
                  <Badge variant="outline" className="text-[9px] ml-1">Recommended</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
