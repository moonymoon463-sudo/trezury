import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bot, Settings, TrendingUp, Shield, DollarSign } from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  type: 'rebalance' | 'take_profit' | 'stop_loss' | 'health_protection';
  isActive: boolean;
  conditions: string;
  actions: string;
  lastTriggered?: string;
  timesTriggered: number;
}

export function AutomationManager() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Health Factor Protection',
      type: 'health_protection',
      isActive: true,
      conditions: 'Health Factor < 1.2',
      actions: 'Reduce borrowing by 25%',
      lastTriggered: '2024-01-15',
      timesTriggered: 3
    },
    {
      id: '2',
      name: 'Yield Optimization',
      type: 'rebalance',
      isActive: true,
      conditions: 'APY difference > 2%',
      actions: 'Move to higher yield pool',
      timesTriggered: 0
    }
  ]);

  const [newRule, setNewRule] = useState({
    name: '',
    type: 'rebalance' as AutomationRule['type'],
    healthFactorThreshold: '1.2',
    rebalancePercentage: '25',
    targetAPY: '5.0'
  });

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, isActive: !rule.isActive }
        : rule
    ));
    
    toast({
      title: "Automation Updated",
      description: "Rule status has been updated",
    });
  };

  const createRule = () => {
    if (!newRule.name) {
      toast({
        variant: "destructive",
        title: "Invalid Rule",
        description: "Please enter a name for the automation rule",
      });
      return;
    }

    const rule: AutomationRule = {
      id: Date.now().toString(),
      name: newRule.name,
      type: newRule.type,
      isActive: true,
      conditions: getConditionsText(newRule),
      actions: getActionsText(newRule),
      timesTriggered: 0
    };

    setRules(prev => [...prev, rule]);
    setNewRule({
      name: '',
      type: 'rebalance',
      healthFactorThreshold: '1.2',
      rebalancePercentage: '25',
      targetAPY: '5.0'
    });

    toast({
      title: "Rule Created",
      description: `Automation rule "${rule.name}" has been created`,
    });
  };

  const getConditionsText = (rule: typeof newRule) => {
    switch (rule.type) {
      case 'health_protection':
        return `Health Factor < ${rule.healthFactorThreshold}`;
      case 'rebalance':
        return `APY difference > ${rule.targetAPY}%`;
      case 'take_profit':
        return `Position profit > ${rule.rebalancePercentage}%`;
      case 'stop_loss':
        return `Position loss > ${rule.rebalancePercentage}%`;
      default:
        return 'Custom conditions';
    }
  };

  const getActionsText = (rule: typeof newRule) => {
    switch (rule.type) {
      case 'health_protection':
        return `Reduce borrowing by ${rule.rebalancePercentage}%`;
      case 'rebalance':
        return 'Move to higher yield pool';
      case 'take_profit':
        return `Sell ${rule.rebalancePercentage}% of position`;
      case 'stop_loss':
        return `Close ${rule.rebalancePercentage}% of position`;
      default:
        return 'Custom actions';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'health_protection': return <Shield className="w-4 h-4" />;
      case 'rebalance': return <TrendingUp className="w-4 h-4" />;
      case 'take_profit': return <DollarSign className="w-4 h-4" />;
      case 'stop_loss': return <Settings className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'health_protection': return 'bg-red-500/20 text-red-400';
      case 'rebalance': return 'bg-blue-500/20 text-blue-400';
      case 'take_profit': return 'bg-green-500/20 text-green-400';
      case 'stop_loss': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Bot className="w-5 h-5 text-primary" />
            Active Automation Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(rule.type)}`}>
                      {getTypeIcon(rule.type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{rule.name}</h3>
                      <p className="text-sm text-gray-400 capitalize">
                        {rule.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Conditions: </span>
                    <span className="text-white">{rule.conditions}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Actions: </span>
                    <span className="text-white">{rule.actions}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    Triggered {rule.timesTriggered} times
                  </div>
                  {rule.lastTriggered && (
                    <div className="text-sm text-gray-400">
                      Last: {rule.lastTriggered}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Create New Automation Rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ruleName" className="text-gray-300">Rule Name</Label>
            <Input
              id="ruleName"
              placeholder="Enter rule name"
              value={newRule.name}
              onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <div>
            <Label htmlFor="ruleType" className="text-gray-300">Rule Type</Label>
            <select
              id="ruleType"
              value={newRule.type}
              onChange={(e) => setNewRule(prev => ({ ...prev, type: e.target.value as any }))}
              className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white"
            >
              <option value="health_protection">Health Factor Protection</option>
              <option value="rebalance">Yield Rebalancing</option>
              <option value="take_profit">Take Profit</option>
              <option value="stop_loss">Stop Loss</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {newRule.type === 'health_protection' && (
              <div>
                <Label className="text-gray-300">Health Factor Threshold</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newRule.healthFactorThreshold}
                  onChange={(e) => setNewRule(prev => ({ ...prev, healthFactorThreshold: e.target.value }))}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            )}
            
            <div>
              <Label className="text-gray-300">
                {newRule.type === 'rebalance' ? 'Target APY (%)' : 'Percentage (%)'}
              </Label>
              <Input
                type="number"
                step="0.1"
                value={newRule.type === 'rebalance' ? newRule.targetAPY : newRule.rebalancePercentage}
                onChange={(e) => setNewRule(prev => ({ 
                  ...prev, 
                  [newRule.type === 'rebalance' ? 'targetAPY' : 'rebalancePercentage']: e.target.value 
                }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          
          <Button onClick={createRule} className="w-full bg-primary hover:bg-primary/90">
            Create Automation Rule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}