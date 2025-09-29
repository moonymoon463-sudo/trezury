import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  title: string;
  content: string;
  summary?: string;
  url?: string;
  publishedAt: string;
  source: string;
  category: string;
  tags: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting financial news collection...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const newsItems: NewsItem[] = [];

    // Fetch from Alpha Vantage News API
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    if (alphaVantageKey) {
      try {
        console.log('📊 Fetching from Alpha Vantage...');
        const alphaResponse = await fetch(
          `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=technology,finance&apikey=${alphaVantageKey}&limit=10`
        );
        
        if (alphaResponse.ok) {
          const alphaData = await alphaResponse.json();
          
          if (alphaData.feed) {
            alphaData.feed.forEach((article: any) => {
              if (article.title && article.summary) {
                newsItems.push({
                  title: article.title,
                  content: article.summary,
                  summary: article.summary.substring(0, 200) + '...',
                  url: article.url,
                  publishedAt: article.time_published,
                  source: 'alpha_vantage',
                  category: 'finance',
                  tags: article.topics?.map((t: any) => t.topic) || ['finance']
                });
              }
            });
            console.log(`✅ Alpha Vantage: Found ${alphaData.feed.length} articles`);
          }
        }
      } catch (error) {
        console.error('❌ Alpha Vantage error:', error);
      }
    }

    // Fetch crypto/gold related news using a free API
    try {
      console.log('📰 Fetching general financial news...');
      const response = await fetch(
        'https://api.coingecko.com/api/v3/news'
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.data) {
          data.data.slice(0, 5).forEach((article: any) => {
            newsItems.push({
              title: article.title,
              content: article.description || article.title,
              summary: (article.description || article.title).substring(0, 200) + '...',
              url: article.url,
              publishedAt: new Date(article.created_at).toISOString(),
              source: 'coingecko',
              category: 'crypto',
              tags: ['crypto', 'market', 'gold']
            });
          });
          console.log(`✅ CoinGecko: Found ${data.data.length} articles`);
        }
      }
    } catch (error) {
      console.error('❌ CoinGecko error:', error);
    }

    // Add some curated gold investment content
    const curatedNews: NewsItem[] = [
      {
        title: "Gold Market Analysis: Q4 2024 Outlook",
        content: "Gold prices continue to show resilience amid global economic uncertainty. Central bank policies and inflation concerns remain key drivers for precious metals demand.",
        summary: "Analysis of current gold market trends and future outlook for Q4 2024.",
        source: 'trezury_editorial',
        publishedAt: new Date().toISOString(),
        category: 'gold',
        tags: ['gold', 'market analysis', 'investment', 'outlook']
      },
      {
        title: "Digital Gold vs Physical Gold: Understanding XAUT Tokens",
        content: "XAUT tokens offer the benefits of gold ownership with the convenience of digital assets. Each token is backed by physical gold stored in secure vaults, providing transparency and liquidity.",
        summary: "Exploring the advantages of digital gold tokens over traditional gold ownership.",
        source: 'trezury_educational',
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        category: 'education',
        tags: ['XAUT', 'digital gold', 'blockchain', 'education']
      }
    ];

    newsItems.push(...curatedNews);

    // Store news items in database
    if (newsItems.length > 0) {
      console.log(`💾 Storing ${newsItems.length} news items...`);
      
      const { data, error } = await supabase
        .from('financial_news')
        .upsert(
          newsItems.map(item => ({
            title: item.title,
            content: item.content,
            summary: item.summary,
            url: item.url,
            published_at: item.publishedAt,
            source: item.source,
            category: item.category,
            tags: item.tags,
            relevance_score: item.category === 'gold' ? 10 : 5
          })),
          { onConflict: 'url' }
        );

      if (error) {
        console.error('Database error:', error);
      } else {
        console.log('✅ News items stored successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        itemsCollected: newsItems.length,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('News collection error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});