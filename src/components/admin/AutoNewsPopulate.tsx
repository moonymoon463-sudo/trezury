import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function AutoNewsPopulate() {
  const [isTriggering, setIsTriggering] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const { toast } = useToast();

  const triggerNewsCollection = async () => {
    if (hasTriggered || isTriggering) return;
    
    setIsTriggering(true);
    try {
      console.log('🚀 Triggering news collection...');
      
      const { data, error } = await supabase.functions.invoke('trigger-news-collection', {
        body: { manual_trigger: true }
      });

      if (error) {
        console.error('Error triggering news collection:', error);
        // Fallback to direct collector call
        const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('financial-news-collector', {
          body: { manual_trigger: true }
        });
        
        if (fallbackError) throw fallbackError;
        
        toast({
          title: "News Collection Started",
          description: "Financial news collection triggered successfully (fallback method)",
        });
        console.log('✅ Fallback news collection triggered:', fallbackData);
      } else {
        toast({
          title: "News Collection Started", 
          description: "Financial news collection triggered successfully",
        });
        console.log('✅ News collection triggered:', data);
      }
      
      setHasTriggered(true);
    } catch (error) {
      console.error('Failed to trigger news collection:', error);
      toast({
        title: "Error",
        description: "Failed to trigger news collection",
        variant: "destructive",
      });
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    // Auto-trigger on mount
    triggerNewsCollection();
  }, []);

  if (hasTriggered) {
    return (
      <div className="text-sm text-muted-foreground">
        ✅ News collection triggered - check financial_news table
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      {isTriggering ? '🔄 Triggering news collection...' : '⏳ Preparing to trigger news collection...'}
    </div>
  );
}