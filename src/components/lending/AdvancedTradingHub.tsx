import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlashLoanManager } from './FlashLoanManager';
import { AutomationManager } from './AutomationManager';
import { LimitOrderManager } from './LimitOrderManager';
import { YieldFarmingHub } from './YieldFarmingHub';
import { TrendingUp, Zap, Bot, Target } from 'lucide-react';

export function AdvancedTradingHub() {
  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Advanced Trading & Automation</CardTitle>
          <p className="text-gray-400">
            Access professional-grade DeFi tools and automated strategies
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="flash-loans" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800">
              <TabsTrigger 
                value="flash-loans" 
                className="data-[state=active]:bg-primary data-[state=active]:text-black text-gray-400 flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Flash Loans
              </TabsTrigger>
              <TabsTrigger 
                value="automation"
                className="data-[state=active]:bg-primary data-[state=active]:text-black text-gray-400 flex items-center gap-2"
              >
                <Bot className="w-4 h-4" />
                Automation
              </TabsTrigger>
              <TabsTrigger 
                value="limit-orders"
                className="data-[state=active]:bg-primary data-[state=active]:text-black text-gray-400 flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                Limit Orders
              </TabsTrigger>
              <TabsTrigger 
                value="yield-farming"
                className="data-[state=active]:bg-primary data-[state=active]:text-black text-gray-400 flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Yield Farming
              </TabsTrigger>
            </TabsList>

            <TabsContent value="flash-loans">
              <FlashLoanManager />
            </TabsContent>

            <TabsContent value="automation">
              <AutomationManager />
            </TabsContent>

            <TabsContent value="limit-orders">
              <LimitOrderManager />
            </TabsContent>

            <TabsContent value="yield-farming">
              <YieldFarmingHub />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}