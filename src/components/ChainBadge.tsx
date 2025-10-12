import { Badge } from '@/components/ui/badge';

interface ChainBadgeProps {
  chain: string;
  className?: string;
}

export const ChainBadge = ({ chain, className }: ChainBadgeProps) => {
  const getChainDisplay = () => {
    switch (chain.toLowerCase()) {
      case 'ethereum':
        return { label: '⟁ Ethereum', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'arbitrum':
        return { label: '⟁ Arbitrum', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'base':
        return { label: '⟁ Base', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      default:
        return { label: `⟁ ${chain}`, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const { label, color } = getChainDisplay();

  return (
    <Badge variant="outline" className={`text-xs ${color} ${className}`}>
      {label}
    </Badge>
  );
};
