import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const NewsSystemTest = () => {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [newsData, setNewsData] = useState<any[]>([]);
  const { toast } = useToast();

  const runSystemTest = async () => {
    setTesting(true);
    setTestResults(null);
    
    try {
      console.log('🧪 Testing financial news system...');
      
      // Step 1: Try to trigger news collection
      const { data: functionData, error: functionError } = await supabase.functions.invoke('financial-news-collector', {
        body: { manual_trigger: true, test_mode: true }
      });

      if (functionError) {
        throw new Error(`Function call failed: ${functionError.message}`);
      }

      console.log('✅ Function response:', functionData);

      // Step 2: Wait a moment and check for data
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: Query the news table
      const { data: newsResponse, error: newsError } = await supabase
        .from('financial_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (newsError) {
        throw new Error(`Database query failed: ${newsError.message}`);
      }

      setNewsData(newsResponse || []);

      // Step 4: Test AI integration
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: { 
          messages: [
            { role: 'user', content: 'What are the latest gold market trends?' }
          ]
        }
      });

      const results = {
        functionCall: {
          success: !functionError,
          data: functionData,
          error: functionError?.message
        },
        dataCollection: {
          success: !newsError && (newsResponse?.length || 0) > 0,
          count: newsResponse?.length || 0,
          latestNews: newsResponse?.[0]?.title || 'No news found'
        },
        aiIntegration: {
          success: !aiError,
          error: aiError?.message
        }
      };

      setTestResults(results);

      if (results.dataCollection.success) {
        toast({
          title: "Test Successful!",
          description: `Found ${results.dataCollection.count} news articles`,
        });
      } else {
        toast({
          title: "Test Issues Detected",
          description: "Check the results below for details",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Test failed:', error);
      setTestResults({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const refreshNewsData = async () => {
    try {
      const { data, error } = await supabase
        .from('financial_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error) {
        setNewsData(data || []);
      }
    } catch (err) {
      console.error('Failed to refresh news data:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Financial News System Test</CardTitle>
          <CardDescription>
            Test the complete financial news collection and AI integration pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={runSystemTest} disabled={testing} className="flex-1">
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing System...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Run Complete Test
                </>
              )}
            </Button>
            <Button variant="outline" onClick={refreshNewsData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {testResults && (
            <div className="space-y-3">
              <h4 className="font-medium">Test Results:</h4>
              
              {testResults.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{testResults.error}</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={testResults.functionCall?.success ? "default" : "destructive"}>
                      Function Call
                    </Badge>
                    <span className="text-sm">
                      {testResults.functionCall?.success ? "✅ Success" : `❌ ${testResults.functionCall?.error}`}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={testResults.dataCollection?.success ? "default" : "destructive"}>
                      Data Collection
                    </Badge>
                    <span className="text-sm">
                      {testResults.dataCollection?.success 
                        ? `✅ ${testResults.dataCollection.count} articles collected` 
                        : "❌ No data collected"}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={testResults.aiIntegration?.success ? "default" : "destructive"}>
                      AI Integration
                    </Badge>
                    <span className="text-sm">
                      {testResults.aiIntegration?.success ? "✅ AI responding" : `❌ ${testResults.aiIntegration?.error}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {newsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Financial News ({newsData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {newsData.slice(0, 5).map((article, index) => (
                <div key={index} className="border-l-2 border-primary/20 pl-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {article.source}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {article.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Score: {article.relevance_score}
                    </span>
                  </div>
                  <h5 className="font-medium text-sm leading-tight">{article.title}</h5>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {article.summary || article.content?.substring(0, 100) + '...'}
                  </p>
                  {article.url && (
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Read more <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};