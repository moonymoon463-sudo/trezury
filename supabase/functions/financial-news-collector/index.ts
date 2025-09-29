import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, getRateLimitHeaders, createRateLimitResponse } from '../_shared/rateLimiter.ts';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    
    if (!isAdmin) {
      console.warn(`Unauthorized access attempt to financial-news-collector by user: ${user.id}`);
      await supabase.rpc('log_security_event', {
        event_type: 'unauthorized_admin_function_access',
        event_data: {
          function: 'financial-news-collector',
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strict rate limiting: 5 requests per hour per user (expensive API calls)
    const rateLimitResult = await checkRateLimit(
      supabaseUrl,
      supabaseKey,
      user.id,
      'financial-news-collector',
      5,
      3600000
    );

    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for financial-news-collector by admin: ${user.id}`);
      await supabase.rpc('log_security_event', {
        event_type: 'rate_limit_exceeded',
        event_data: {
          function: 'financial-news-collector',
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    console.log(`🚀 Starting financial news collection (triggered by admin: ${user.id})...`);

    const newsItems: NewsItem[] = [];

    // NewsAPI.org integration for premium sources
    async function fetchFromNewsAPI(): Promise<NewsItem[]> {
      const items: NewsItem[] = [];
      const apiKey = Deno.env.get('NEWS_API_KEY');
      
      if (!apiKey) {
        console.warn('NEWS_API_KEY not configured, skipping NewsAPI sources');
        return [];
      }

      try {
        // Multiple NewsAPI queries for comprehensive coverage
        const queries = [
          // Business news from top sources
          {
            url: `https://newsapi.org/v2/top-headlines?category=business&sources=financial-times,wall-street-journal,reuters,bloomberg&apiKey=${apiKey}`,
            category: 'business'
          },
          // Gold and precious metals specific
          {
            url: `https://newsapi.org/v2/everything?q=(gold OR "precious metals" OR "gold price")&sources=reuters,bloomberg,financial-times&sortBy=publishedAt&from=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&apiKey=${apiKey}`,
            category: 'precious_metals'
          },
          // Economic indicators and Fed news
          {
            url: `https://newsapi.org/v2/everything?q=("federal reserve" OR "interest rates" OR inflation OR economy)&sources=reuters,bloomberg,financial-times&sortBy=publishedAt&from=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&apiKey=${apiKey}`,
            category: 'economics'
          }
        ];

        for (const query of queries) {
          try {
            console.log(`📰 Fetching NewsAPI ${query.category}...`);
            const response = await fetch(query.url, {
              headers: {
                'User-Agent': 'Financial News Collector'
              }
            });

            if (!response.ok) {
              console.error(`NewsAPI error for ${query.category}:`, response.status, response.statusText);
              continue;
            }

            const data = await response.json();
            
            if (data.status === 'ok' && data.articles) {
              let addedCount = 0;
              for (const article of data.articles.slice(0, 5)) {
                if (!article.title || !article.description || !article.publishedAt) continue;
                
                // Skip articles without meaningful content
                if (article.title.includes('[Removed]') || article.description.includes('[Removed]')) continue;
                
                const publishedAt = new Date(article.publishedAt);
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                
                // Only include recent articles (last 24 hours)
                if (publishedAt < oneDayAgo) continue;

                // Check if content is relevant
                const titleContent = article.title + ' ' + (article.description || '');
                if (!isRelevantContent(article.title, article.description || '')) continue;

                items.push({
                  title: article.title,
                  content: article.description || article.content || '',
                  summary: article.description?.substring(0, 200) + '...' || '',
                  url: article.url,
                  publishedAt: publishedAt.toISOString(),
                  source: `NewsAPI - ${article.source?.name || 'Unknown'}`,
                  category: query.category,
                  tags: [query.category, 'newsapi', 'premium', article.source?.name?.toLowerCase() || 'unknown']
                });
                addedCount++;
              }
              console.log(`✅ NewsAPI ${query.category}: Added ${addedCount}/${data.articles.length} relevant articles`);
            }
            
            // Rate limiting: wait between requests to avoid hitting API limits
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`Error fetching from NewsAPI ${query.category}:`, error);
          }
        }

        console.log(`📰 NewsAPI Total: Collected ${items.length} articles from premium sources`);
        return items;
        
      } catch (error) {
        console.error('Error in NewsAPI collector:', error);
        return [];
      }
    }

    // Helper function to calculate content relevance score
    const calculateRelevanceScore = (title: string, content: string, source: string, category: string): number => {
      let score = 5; // base score
      
      const goldKeywords = ['gold', 'precious metals', 'xauusd', 'xau/usd', 'bullion', 'troy ounce'];
      const economicKeywords = ['inflation', 'fed', 'federal reserve', 'interest rates', 'monetary policy', 'dollar index', 'dxy', 'treasury'];
      const highImpactKeywords = ['central bank', 'economic uncertainty', 'geopolitical', 'recession', 'rate cut', 'rate hike'];
      
      const titleLower = title.toLowerCase();
      const contentLower = content.toLowerCase();
      
      // Category-based scoring
      if (category === 'gold') score += 6;
      if (category === 'education') score += 4;
      if (category === 'economic_indicators') score += 5;
      
      // Keyword scoring with weighted importance
      goldKeywords.forEach(keyword => {
        if (titleLower.includes(keyword)) score += 4;
        if (contentLower.includes(keyword)) score += 2;
      });
      
      economicKeywords.forEach(keyword => {
        if (titleLower.includes(keyword)) score += 3;
        if (contentLower.includes(keyword)) score += 1;
      });
      
      highImpactKeywords.forEach(keyword => {
        if (titleLower.includes(keyword)) score += 3;
        if (contentLower.includes(keyword)) score += 2;
      });
      
      // Source reliability scoring
      const premiumSources = ['reuters', 'financial_times', 'bloomberg', 'yahoo_finance', 'federal_reserve'];
      const reliableSources = ['marketwatch', 'cnbc', 'google_news'];
      
      if (premiumSources.includes(source)) score += 3;
      else if (reliableSources.includes(source)) score += 2;
      
      return Math.min(score, 25); // Cap at 25
    };

    // Helper function to check if content is gold/investment relevant
    const isRelevantContent = (title: string, content: string): boolean => {
      const relevantKeywords = [
        'gold', 'precious metals', 'xauusd', 'xau/usd', 'bullion',
        'inflation', 'fed', 'federal reserve', 'interest rates', 'monetary policy',
        'dollar', 'dxy', 'treasury', 'central bank', 'commodity', 'commodities',
        'economic uncertainty', 'recession', 'market volatility', 'safe haven',
        'investment', 'portfolio', 'hedge', 'diversification'
      ];
      
      const textToCheck = (title + ' ' + content).toLowerCase();
      return relevantKeywords.some(keyword => textToCheck.includes(keyword));
    };

    // Helper function to parse RSS content
    const parseRSSItem = (item: string, source: string, category: string): NewsItem | null => {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/);
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      
      if (!titleMatch || !linkMatch) return null;
      
      const title = titleMatch[1];
      const content = descMatch ? descMatch[1].replace(/<[^>]*>/g, '') : title;
      
      if (!isRelevantContent(title, content)) return null;
      
      return {
        title,
        content,
        summary: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        url: linkMatch[1],
        publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
        source,
        category,
        tags: [category, source.replace('_', ' '), 'financial news']
      };
    };

    // Fetch news from NewsAPI first (premium sources)
    try {
      const newsAPIItems = await fetchFromNewsAPI();
      newsItems.push(...newsAPIItems);
    } catch (error) {
      console.error('NewsAPI integration error:', error);
    }

    // Fetch from Google News RSS (Free)
    try {
      console.log('🔍 Fetching gold news from Google News RSS...');
      const googleNewsResponse = await fetch(
        'https://news.google.com/rss/search?q=gold+price+OR+precious+metals+OR+inflation+OR+federal+reserve&hl=en-US&gl=US&ceid=US:en'
      );
      
      if (googleNewsResponse.ok) {
        const rssText = await googleNewsResponse.text();
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        let addedCount = 0;
        itemMatches.slice(0, 8).forEach((item: string) => {
          const parsedItem = parseRSSItem(item, 'google_news', 'general');
          if (parsedItem) {
            parsedItem.tags.push('google news', 'breaking');
            newsItems.push(parsedItem);
            addedCount++;
          }
        });
        console.log(`✅ Google News: Added ${addedCount}/${itemMatches.length} relevant articles`);
      }
    } catch (error) {
      console.error('❌ Google News error:', error);
    }

    // Fetch from Bloomberg RSS (Free)
    try {
      console.log('📈 Fetching Bloomberg markets news...');
      const bloombergResponse = await fetch(
        'https://feeds.bloomberg.com/markets/news.rss'
      );
      
      if (bloombergResponse.ok) {
        const rssText = await bloombergResponse.text();
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        let addedCount = 0;
        itemMatches.slice(0, 6).forEach((item: string) => {
          const parsedItem = parseRSSItem(item, 'bloomberg', 'markets');
          if (parsedItem) {
            parsedItem.tags.push('bloomberg', 'markets', 'premium');
            newsItems.push(parsedItem);
            addedCount++;
          }
        });
        console.log(`✅ Bloomberg: Added ${addedCount}/${itemMatches.length} relevant articles`);
      }
    } catch (error) {
      console.error('❌ Bloomberg error:', error);
    }

    // Fetch from CNBC RSS (Free)
    try {
      console.log('📺 Fetching CNBC markets news...');
      const cnbcResponse = await fetch(
        'https://www.cnbc.com/id/100727362/device/rss/rss.html'
      );
      
      if (cnbcResponse.ok) {
        const rssText = await cnbcResponse.text();
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        let addedCount = 0;
        itemMatches.slice(0, 6).forEach((item: string) => {
          const parsedItem = parseRSSItem(item, 'cnbc', 'markets');
          if (parsedItem) {
            parsedItem.tags.push('cnbc', 'television', 'analysis');
            newsItems.push(parsedItem);
            addedCount++;
          }
        });
        console.log(`✅ CNBC: Added ${addedCount}/${itemMatches.length} relevant articles`);
      }
    } catch (error) {
      console.error('❌ CNBC error:', error);
    }

    // Fetch from Kitco (Gold-focused RSS)
    try {
      console.log('🥇 Fetching specialized gold news from Kitco...');
      const kitcoResponse = await fetch(
        'https://www.kitco.com/rss/KitcoNews.xml'
      );
      
      if (kitcoResponse.ok) {
        const rssText = await kitcoResponse.text();
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        itemMatches.slice(0, 5).forEach((item: string) => {
          const parsedItem = parseRSSItem(item, 'kitco', 'gold');
          if (parsedItem) {
            parsedItem.tags.push('kitco', 'gold specialist', 'precious metals');
            newsItems.push(parsedItem);
          }
        });
        console.log(`✅ Kitco: Added ${itemMatches.length} gold specialist articles`);
      }
    } catch (error) {
      console.error('❌ Kitco error:', error);
    }

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
        
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        let addedCount = 0;
        itemMatches.slice(0, 5).forEach((item: string) => {
          const parsedItem = parseRSSItem(item, 'marketwatch', 'markets');
          if (parsedItem) {
            parsedItem.tags.push('marketwatch', 'top stories');
            newsItems.push(parsedItem);
            addedCount++;
          }
        });
        console.log(`✅ MarketWatch: Added ${addedCount}/${itemMatches.length} relevant articles`);
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
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        let addedCount = 0;
        itemMatches.slice(0, 4).forEach((item: string) => {
          const parsedItem = parseRSSItem(item, 'financial_times', 'commodities');
          if (parsedItem) {
            parsedItem.tags.push('financial times', 'premium', 'commodities');
            newsItems.push(parsedItem);
            addedCount++;
          }
        });
        console.log(`✅ Financial Times: Added ${addedCount}/${itemMatches.length} relevant commodities articles`);
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
        const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        let addedCount = 0;
        itemMatches.slice(0, 5).forEach((item: string) => {
          const parsedItem = parseRSSItem(item, 'reuters', 'business');
          if (parsedItem) {
            parsedItem.tags.push('reuters', 'global news', 'business');
            newsItems.push(parsedItem);
            addedCount++;
          }
        });
        console.log(`✅ Reuters: Added ${addedCount}/${itemMatches.length} relevant business articles`);
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
          newsItems.map(item => ({
            title: item.title,
            content: item.content,
            summary: item.summary,
            url: item.url,
            published_at: item.publishedAt,
            source: item.source,
            category: item.category,
            tags: item.tags,
            relevance_score: calculateRelevanceScore(item.title, item.content, item.source, item.category)
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

  } catch (error: unknown) {
    console.error('News collection error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});