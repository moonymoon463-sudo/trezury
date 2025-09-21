import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSwipeable } from 'react-swipeable';
import { Smartphone, Tablet, Monitor, Zap, TrendingUp, Shield } from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
}

export function MobileOptimizedDashboard() {
  const [activeCard, setActiveCard] = useState(0);
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  const quickActions: QuickAction[] = [
    {
      id: 'supply',
      title: 'Supply Assets',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-green-500',
      action: () => console.log('Supply action')
    },
    {
      id: 'borrow',
      title: 'Borrow Funds',
      icon: <Zap className="w-5 h-5" />,
      color: 'bg-blue-500',
      action: () => console.log('Borrow action')
    },
    {
      id: 'manage',
      title: 'Manage Risk',
      icon: <Shield className="w-5 h-5" />,
      color: 'bg-yellow-500',
      action: () => console.log('Risk management')
    }
  ];

  const portfolioCards = [
    {
      title: 'Total Portfolio',
      value: '$45,287.50',
      change: '+12.5%',
      changeColor: 'text-green-400'
    },
    {
      title: 'Supplied Assets',
      value: '$38,429.10',
      change: '+8.2%',
      changeColor: 'text-green-400'
    },
    {
      title: 'Borrowed Assets',
      value: '$15,230.40',
      change: '-2.1%',
      changeColor: 'text-red-400'
    },
    {
      title: 'Health Factor',
      value: '2.45',
      change: 'Safe',
      changeColor: 'text-green-400'
    }
  ];

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setActiveCard(prev => Math.min(prev + 1, portfolioCards.length - 1));
    },
    onSwipedRight: () => {
      setActiveCard(prev => Math.max(prev - 1, 0));
    },
    trackMouse: true
  });

  const getViewportIcon = (mode: string) => {
    switch (mode) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      case 'desktop': return <Monitor className="w-4 h-4" />;
      default: return <Smartphone className="w-4 h-4" />;
    }
  };

  const getViewportStyles = () => {
    switch (viewportMode) {
      case 'mobile':
        return 'max-w-sm mx-auto';
      case 'tablet':
        return 'max-w-2xl mx-auto';
      case 'desktop':
        return 'max-w-6xl mx-auto';
      default:
        return 'max-w-sm mx-auto';
    }
  };

  return (
    <div className="space-y-6">
      {/* Viewport Simulator */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Mobile Experience Simulator</CardTitle>
          <div className="flex gap-2">
            {['mobile', 'tablet', 'desktop'].map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={viewportMode === mode ? 'default' : 'outline'}
                onClick={() => setViewportMode(mode as any)}
                className="flex items-center gap-2"
              >
                {getViewportIcon(mode)}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Mobile-Optimized Layout */}
      <div className={getViewportStyles()}>
        <div className="space-y-4">
          {/* Swipeable Portfolio Cards */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-center">Portfolio Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                {...swipeHandlers}
                className="relative overflow-hidden"
              >
                <div 
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${activeCard * 100}%)` }}
                >
                  {portfolioCards.map((card, index) => (
                    <div key={index} className="w-full flex-shrink-0 p-4 text-center">
                      <div className="text-gray-400 text-sm mb-2">{card.title}</div>
                      <div className="text-white text-2xl font-bold mb-1">{card.value}</div>
                      <div className={`text-sm ${card.changeColor}`}>{card.change}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Card Indicators */}
              <div className="flex justify-center gap-2 mt-4">
                {portfolioCards.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveCard(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === activeCard ? 'bg-primary' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              
              <div className="text-center text-gray-400 text-xs mt-2">
                Swipe left/right to navigate
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Card key={action.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4 text-center">
                  <div className={`${action.color} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2`}>
                    {action.icon}
                  </div>
                  <div className="text-white text-sm font-medium">{action.title}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Touch-Friendly Action Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-lg">
                Open Action Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-gray-900 border-gray-800 h-[70vh]">
              <SheetHeader>
                <SheetTitle className="text-white">Quick Actions</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <Button className="w-full h-12 text-lg bg-green-600 hover:bg-green-700">
                  Supply Assets
                </Button>
                <Button className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700">
                  Borrow Funds
                </Button>
                <Button className="w-full h-12 text-lg bg-yellow-600 hover:bg-yellow-700">
                  Manage Positions
                </Button>
                <Button className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-700">
                  View Analytics
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile-Specific Features */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Mobile Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="text-gray-400">Touch Gestures</div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">Swipe Navigation</Badge>
                    <Badge variant="outline" className="text-xs">Pull to Refresh</Badge>
                    <Badge variant="outline" className="text-xs">Long Press Actions</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-gray-400">Optimization</div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">Lazy Loading</Badge>
                    <Badge variant="outline" className="text-xs">Image Compression</Badge>
                    <Badge variant="outline" className="text-xs">Offline Support</Badge>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-700">
                <div className="text-gray-400 text-sm mb-2">Progressive Web App Features</div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-blue-500/20 text-blue-400">Install to Home Screen</Badge>
                  <Badge className="bg-green-500/20 text-green-400">Push Notifications</Badge>
                  <Badge className="bg-purple-500/20 text-purple-400">Background Sync</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responsive Design Indicators */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Responsive Breakpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Mobile (&lt; 768px)</span>
                  <Badge className={viewportMode === 'mobile' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20'}>
                    {viewportMode === 'mobile' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Tablet (768px - 1024px)</span>
                  <Badge className={viewportMode === 'tablet' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20'}>
                    {viewportMode === 'tablet' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Desktop (&gt; 1024px)</span>
                  <Badge className={viewportMode === 'desktop' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20'}>
                    {viewportMode === 'desktop' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}