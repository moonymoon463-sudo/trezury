import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  summary?: string;
  source: string;
  category: string;
  published_at: string;
  tags: string[];
  url?: string;
  relevance_score?: number;
}

interface NewsFeedProps {
  news: NewsItem[];
  title?: string;
  maxItems?: number;
  showSummary?: boolean;
  compact?: boolean;
}

export const NewsFeed = ({
  news,
  title = "Latest Financial News",
  maxItems = 10,
  showSummary = true,
  compact = false
}: NewsFeedProps) => {
  const displayNews = news.slice(0, maxItems);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'gold':
      case 'precious metals':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'crypto':
      case 'cryptocurrency':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'economics':
      case 'fed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'markets':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (compact) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {displayNews.map((item) => (
                <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 mb-1">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{formatTime(item.published_at)}</span>
                    </div>
                  </div>
                  {item.url && (
                    <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {displayNews.map((item) => (
              <div key={item.id} className="border-b border-border/50 pb-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-medium text-sm leading-relaxed flex-1">{item.title}</h3>
                  {item.url && (
                    <Button variant="ghost" size="sm" className="p-1 h-7 w-7 flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                {showSummary && item.summary && (
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                    {item.summary}
                  </p>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getCategoryColor(item.category)}>
                      {item.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.source}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(item.published_at)}</span>
                    {item.relevance_score && (
                      <Badge variant="outline" className="text-xs">
                        {item.relevance_score}/10
                      </Badge>
                    )}
                  </div>
                </div>
                
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NewsFeed;