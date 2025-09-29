import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, NewspaperIcon, Calendar, ExternalLink } from 'lucide-react';
import { useEnhancedAI } from '@/hooks/useEnhancedAI';
import { formatDistanceToNow } from 'date-fns';
import { NewsSystemTest } from './NewsSystemTest';

export const NewsManagement: React.FC = () => {
  const { getRecentNews, collectFinancialNews, loading } = useEnhancedAI();
  const [news, setNews] = useState<any[]>([]);
  const [collecting, setCollecting] = useState(false);

  const loadNews = async () => {
    const newsData = await getRecentNews(undefined, 20);
    setNews(newsData);
  };

  const handleCollectNews = async () => {
    setCollecting(true);
    await collectFinancialNews();
    await loadNews();
    setCollecting(false);
  };

  useEffect(() => {
    loadNews();
  }, []);

  return (
    <div className="space-y-6">
      {/* News System Test */}
      <NewsSystemTest />
      
      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <NewspaperIcon size={20} />
            Financial News Management
          </CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={loadNews}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Refresh
            </Button>
            <Button
              onClick={handleCollectNews}
              size="sm"
              disabled={collecting}
            >
              {collecting ? <Loader2 size={16} className="animate-spin" /> : <NewspaperIcon size={16} />}
              Collect News
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-96">
          {news.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <NewspaperIcon size={40} className="mx-auto mb-4 opacity-50" />
              <p>No financial news available. Click "Collect News" to fetch latest updates.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {news.map((item) => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.source}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar size={12} />
                      {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                    </div>
                  </div>
                  
                  <h4 className="font-medium text-sm mb-1 line-clamp-2">
                    {item.title}
                  </h4>
                  
                  {item.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {item.summary}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {item.tags?.slice(0, 3).map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    {item.url && (
                      <Button variant="ghost" size="sm" className="h-6 px-2" asChild>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={12} />
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
    </div>
  );
};