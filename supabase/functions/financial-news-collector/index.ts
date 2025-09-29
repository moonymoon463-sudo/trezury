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

    // Fetch from Yahoo Finance News (Free API)
    try {
      console.log('📊 Fetching gold news from Yahoo Finance...');
      const yahooResponse = await fetch(
        'https://query1.finance.yahoo.com/v1/finance/search?q=gold+price+XAUUSD+precious+metals&lang=en-US&region=US&quotesCount=0&newsCount=10'
      );
      
      if (yahooResponse.ok) {
        const yahooData = await yahooResponse.json();
        
        if (yahooData.news) {
          yahooData.news.forEach((article: any) => {
            if (article.title && article.publisher) {
              newsItems.push({
                title: article.title,
                content: article.summary || article.title,
                summary: (article.summary || article.title).substring(0, 200) + '...',
                url: article.link,
                publishedAt: new Date(article.providerPublishTime * 1000).toISOString(),
                source: 'yahoo_finance',
                category: 'gold',
                tags: ['gold', 'precious metals', 'market news', 'yahoo finance']
              });
            }
          });
          console.log(`✅ Yahoo Finance: Found ${yahooData.news.length} gold articles`);
        }
      }
    } catch (error) {
      console.error('❌ Yahoo Finance error:', error);
    }

    // Fetch from MarketWatch RSS (Free)
    try {
      console.log('📰 Fetching from MarketWatch RSS...');
      const marketWatchResponse = await fetch(
        'https://feeds.marketwatch.com/marketwatch/topstories/'
      );
      
      if (marketWatchResponse.ok) {
        const rssText = await marketWatchResponse.text();
        
        // Simple RSS parsing for gold-related content
        const goldKeywords = ['gold', 'precious metals', 'XAUUSD', 'inflation', 'fed', 'interest rates', 'dollar'];
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        itemMatches.slice(0, 5).forEach((item: string) => {
          const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
          const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
          
          if (titleMatch && linkMatch) {
            const title = titleMatch[1];
            const content = descMatch ? descMatch[1] : title;
            
            // Check if content is gold-related
            const isGoldRelated = goldKeywords.some(keyword => 
              title.toLowerCase().includes(keyword) || content.toLowerCase().includes(keyword)
            );
            
            if (isGoldRelated) {
              newsItems.push({
                title,
                content: content.replace(/<[^>]*>/g, ''), // Strip HTML
                summary: content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
                url: linkMatch[1],
                publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                source: 'marketwatch',
                category: 'gold',
                tags: ['gold', 'market news', 'financial markets']
              });
            }
          }
        });
        console.log(`✅ MarketWatch: Found ${itemMatches.length} articles`);
      }
    } catch (error) {
      console.error('❌ MarketWatch error:', error);
    }

    // Fetch crypto/gold related news using a free API
    try {
      console.log('📰 Fetching CoinGecko crypto news...');
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

    // Fetch Federal Reserve Economic Data (FRED) - Free API for economic indicators
    try {
      console.log('🏛️ Fetching economic indicators affecting gold...');
      // Note: FRED API requires registration but is free
      const fredResponse = await fetch(
        'https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=demo&file_type=json&limit=1'
      );
      
      if (fredResponse.ok) {
        const fredData = await fredResponse.json();
        if (fredData.observations && fredData.observations.length > 0) {
          const latestRate = fredData.observations[0].value;
          newsItems.push({
            title: `10-Year Treasury Rate Update: ${latestRate}%`,
            content: `The 10-year Treasury yield is currently at ${latestRate}%. Changes in interest rates significantly impact gold prices as they affect the opportunity cost of holding non-yielding assets like gold.`,
            summary: `Current 10-year Treasury rate: ${latestRate}%. Key factor affecting gold prices.`,
            source: 'federal_reserve',
            publishedAt: new Date().toISOString(),
            category: 'economic_indicators',
            tags: ['interest rates', 'treasury', 'gold impact', 'fed']
          });
        }
      }
    } catch (error) {
      console.error('❌ FRED API error:', error);
    }

    // Fetch from Financial Times RSS (Free)
    try {
      console.log('📰 Fetching Financial Times commodities news...');
      const ftResponse = await fetch(
        'https://www.ft.com/commodities?format=rss'
      );
      
      if (ftResponse.ok) {
        const rssText = await ftResponse.text();
        const goldKeywords = ['gold', 'precious metals', 'inflation', 'central bank', 'monetary policy'];
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        itemMatches.slice(0, 3).forEach((item: string) => {
          const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
          const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
          
          if (titleMatch && linkMatch) {
            const title = titleMatch[1];
            const content = descMatch ? descMatch[1] : title;
            
            const isGoldRelated = goldKeywords.some(keyword => 
              title.toLowerCase().includes(keyword) || content.toLowerCase().includes(keyword)
            );
            
            if (isGoldRelated) {
              newsItems.push({
                title,
                content: content.replace(/<[^>]*>/g, ''),
                summary: content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
                url: linkMatch[1],
                publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                source: 'financial_times',
                category: 'commodities',
                tags: ['commodities', 'gold', 'financial times', 'market analysis']
              });
            }
          }
        });
        console.log(`✅ Financial Times: Processed ${itemMatches.length} commodities articles`);
      }
    } catch (error) {
      console.error('❌ Financial Times error:', error);
    }

    // Fetch from Reuters Commodities RSS (Free)
    try {
      console.log('📰 Fetching Reuters commodities news...');
      const reutersResponse = await fetch(
        'https://feeds.reuters.com/reuters/businessNews'
      );
      
      if (reutersResponse.ok) {
        const rssText = await reutersResponse.text();
        const goldKeywords = ['gold', 'precious metals', 'commodity', 'inflation', 'dollar', 'federal reserve'];
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        itemMatches.slice(0, 5).forEach((item: string) => {
          const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
          const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
          
          if (titleMatch && linkMatch) {
            const title = titleMatch[1];
            const content = descMatch ? descMatch[1] : title;
            
            const isGoldRelated = goldKeywords.some(keyword => 
              title.toLowerCase().includes(keyword) || content.toLowerCase().includes(keyword)
            );
            
            if (isGoldRelated) {
              newsItems.push({
                title,
                content: content.replace(/<[^>]*>/g, ''),
                summary: content.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
                url: linkMatch[1],
                publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                source: 'reuters',
                category: 'business',
                tags: ['business', 'commodities', 'gold', 'reuters']
              });
            }
          }
        });
        console.log(`✅ Reuters: Processed ${itemMatches.length} business articles`);
      }
    } catch (error) {
      console.error('❌ Reuters error:', error);
    }

    // Add comprehensive curated gold investment content
    const curatedNews: NewsItem[] = [
      {
        title: "Gold Market Analysis: Key Factors Driving 2024 Prices",
        content: "Gold prices are influenced by multiple factors: Federal Reserve interest rate decisions, inflation rates, US Dollar strength, geopolitical tensions, central bank gold purchases, and economic uncertainty. Current analysis shows mixed signals with potential for both upward and downward pressure depending on economic data releases.",
        summary: "Comprehensive analysis of factors affecting gold prices in 2024 market conditions.",
        source: 'trezury_editorial',
        publishedAt: new Date().toISOString(),
        category: 'gold',
        tags: ['gold', 'market analysis', 'fed policy', 'inflation', 'dollar']
      },
      {
        title: "Digital Gold vs Physical Gold: Understanding XAUT Tokens",
        content: "XAUT tokens offer the benefits of gold ownership with the convenience of digital assets. Each token is backed by physical gold stored in secure vaults, providing transparency and liquidity. This represents a modern approach to gold investment without storage concerns.",
        summary: "Exploring the advantages of digital gold tokens over traditional gold ownership.",
        source: 'trezury_educational',
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        category: 'education',
        tags: ['XAUT', 'digital gold', 'blockchain', 'education']
      },
      {
        title: "How Interest Rates Impact Gold Prices: Investor's Guide",
        content: "When interest rates rise, gold typically faces downward pressure as investors can earn yields from bonds and savings accounts. Conversely, when rates fall or inflation exceeds interest rates, gold becomes more attractive as a store of value. The current rate environment suggests continued volatility for gold prices.",
        summary: "Understanding the inverse relationship between interest rates and gold prices.",
        source: 'trezury_educational',
        publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        category: 'education',
        tags: ['interest rates', 'gold', 'investment education', 'fed policy']
      },
      {
        title: "Central Bank Gold Purchases Reach Record Highs",
        content: "Global central banks have been net buyers of gold for over a decade, with purchases accelerating in recent years. This institutional demand provides a strong foundation for gold prices, especially from emerging market central banks seeking to diversify away from dollar reserves.",
        summary: "Central bank gold buying trends and their impact on global gold demand.",
        source: 'trezury_editorial',
        publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        category: 'gold',
        tags: ['central banks', 'gold demand', 'institutional buying', 'reserves']
      },
      {
        title: "Inflation Hedge: Gold's Performance During Economic Uncertainty",
        content: "Historically, gold has served as an inflation hedge during periods of currency debasement and economic uncertainty. While short-term correlations can vary, long-term data shows gold maintaining purchasing power over decades, making it valuable for portfolio diversification.",
        summary: "Historical analysis of gold's performance as an inflation hedge.",
        source: 'trezury_educational',
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        category: 'education',
        tags: ['inflation', 'hedge', 'economic uncertainty', 'portfolio diversification']
      },
      {
        title: "USD Strength vs Gold: Understanding the Relationship",
        content: "Gold is priced in US dollars globally, creating an inverse relationship between dollar strength and gold prices. When the dollar strengthens against other currencies, gold becomes more expensive for international buyers, typically reducing demand. Monitoring the Dollar Index (DXY) is crucial for gold investors.",
        summary: "Exploring how US dollar movements affect gold pricing and investment strategies.",
        source: 'trezury_educational',
        publishedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        category: 'education',
        tags: ['USD', 'dollar index', 'currency', 'gold pricing']
      }
    ];

    newsItems.push(...curatedNews);

    // Store news items in database
    if (newsItems.length > 0) {
      console.log(`💾 Storing ${newsItems.length} news items...`);
      
      const { data, error } = await supabase
        .from('financial_news')
        .upsert(
          newsItems.map(item => {
            // Calculate relevance score based on gold-related keywords and source
            let relevanceScore = 5; // base score
            
            const goldKeywords = ['gold', 'precious metals', 'xauusd', 'inflation', 'fed', 'interest rates', 'dollar index', 'central bank'];
            const highImpactKeywords = ['federal reserve', 'monetary policy', 'economic uncertainty', 'geopolitical'];
            
            const titleLower = item.title.toLowerCase();
            const contentLower = item.content.toLowerCase();
            
            // Boost score for gold-specific content
            if (item.category === 'gold') relevanceScore += 5;
            
            // Boost for gold-related keywords
            goldKeywords.forEach(keyword => {
              if (titleLower.includes(keyword) || contentLower.includes(keyword)) {
                relevanceScore += 2;
              }
            });
            
            // Extra boost for high-impact keywords
            highImpactKeywords.forEach(keyword => {
              if (titleLower.includes(keyword) || contentLower.includes(keyword)) {
                relevanceScore += 3;
              }
            });
            
            // Source-based scoring
            const premiumSources = ['reuters', 'financial_times', 'yahoo_finance', 'federal_reserve'];
            if (premiumSources.includes(item.source)) {
              relevanceScore += 2;
            }
            
            // Educational content gets high relevance
            if (item.category === 'education') {
              relevanceScore += 4;
            }
            
            return {
              title: item.title,
              content: item.content,
              summary: item.summary,
              url: item.url,
              published_at: item.publishedAt,
              source: item.source,
              category: item.category,
              tags: item.tags,
              relevance_score: Math.min(relevanceScore, 20) // Cap at 20
            };
          }),
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