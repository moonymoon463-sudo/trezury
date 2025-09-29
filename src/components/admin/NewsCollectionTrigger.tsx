import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Newspaper, RefreshCw, CheckCircle } from 'lucide-react';
import { useFinancialDataCollection } from '@/hooks/useFinancialDataCollection';

export const NewsCollectionTrigger = () => {
  const { loading, triggerNewsCollection, getLatestNews } = useFinancialDataCollection();
  const [newsCount, setNewsCount] = React.useState(0);

  React.useEffect(() => {
    const checkNews = async () => {
      const news = await getLatestNews(5);
      setNewsCount(news.length);
    };
    checkNews();
  }, [getLatestNews]);

  const handleTrigger = async () => {
    await triggerNewsCollection();
    // Refresh count after collection
    setTimeout(async () => {
      const news = await getLatestNews(5);
      setNewsCount(news.length);
    }, 2000);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Newspaper className="w-5 h-5 text-primary" />
          Financial News Collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current news articles:</span>
          <span className="font-medium">{newsCount}</span>
        </div>
        
        <Button
          onClick={handleTrigger}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Collecting News...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Trigger News Collection
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground">
          This will fetch the latest financial news from multiple sources including Yahoo Finance, MarketWatch, and Federal Reserve economic data.
        </p>
      </CardContent>
    </Card>
  );
};