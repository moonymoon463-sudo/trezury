-- Fix FAQ categories and populate comprehensive knowledge base

-- Delete existing limited content to replace with comprehensive content
DELETE FROM faq_items;
DELETE FROM educational_content;

-- Insert comprehensive FAQ items using correct category references
INSERT INTO faq_items (question, answer, keywords, category_id, display_order, is_active) VALUES

-- Getting Started FAQs
('How do I view my current gold holdings?', 'Navigate to the Portfolio section where you can see your current XAUT (gold) balance, its USD value, and performance metrics. The portfolio displays real-time data including 24-hour changes and allocation percentages.', ARRAY['portfolio', 'holdings', 'balance', 'xaut'], (SELECT id FROM faq_categories WHERE name = 'Getting Started'), 1, true),

('What does XAUT represent?', 'XAUT is a gold-backed digital token where each token represents one troy ounce of physical gold stored in secure vaults. It combines the stability of gold with the convenience of digital assets.', ARRAY['xaut', 'gold', 'token', 'troy ounce'], (SELECT id FROM faq_categories WHERE name = 'Gold Investing'), 1, true),

('How is my portfolio value calculated?', 'Your portfolio value is calculated by multiplying your XAUT holdings by the current gold price per ounce. Real-time pricing ensures accurate valuations updated throughout market hours.', ARRAY['portfolio', 'value', 'calculation', 'pricing'], (SELECT id FROM faq_categories WHERE name = 'Getting Started'), 2, true),

-- Transactions FAQs
('How do I buy gold through the platform?', 'Use the Buy Gold feature to purchase XAUT tokens. You can fund purchases with USDC or through MoonPay using bank cards. Each purchase is backed by real physical gold.', ARRAY['buy', 'purchase', 'gold', 'xaut', 'usdc', 'moonpay'], (SELECT id FROM faq_categories WHERE name = 'Transactions'), 1, true),

('What are the trading fees?', 'The platform charges a 1% fee on all buy and sell transactions. This covers platform operations, security, and the physical gold storage and insurance costs.', ARRAY['fees', 'trading', 'cost', 'commission'], (SELECT id FROM faq_categories WHERE name = 'Transactions'), 2, true),

('How long do transactions take to process?', 'USDC transactions typically process within minutes. Bank card payments through MoonPay may take 1-3 business days depending on your bank and KYC verification status.', ARRAY['transaction', 'processing', 'time', 'settlement'], (SELECT id FROM faq_categories WHERE name = 'Transactions'), 3, true),

('Can I set up recurring purchases?', 'Yes, use the Auto-Invest feature to set up recurring gold purchases. You can choose weekly, bi-weekly, or monthly schedules with custom amounts to dollar-cost average your investments.', ARRAY['recurring', 'auto-invest', 'dca', 'schedule'], (SELECT id FROM faq_categories WHERE name = 'App Features'), 1, true),

-- Security & KYC FAQs
('How secure is my gold investment?', 'Your gold is stored in fully insured, professional-grade vaults with 24/7 security. The platform uses enterprise-grade encryption and multi-factor authentication to protect your digital assets.', ARRAY['security', 'storage', 'vault', 'insurance'], (SELECT id FROM faq_categories WHERE name = 'Security & KYC'), 1, true),

('What happens if I lose access to my account?', 'Contact support immediately. With proper identity verification, account access can be restored. However, always enable 2FA and store recovery information securely as a precaution.', ARRAY['account', 'recovery', 'access', 'support'], (SELECT id FROM faq_categories WHERE name = 'Security & KYC'), 2, true),

('Is my personal information protected?', 'Yes, all personal information is encrypted and stored securely. We comply with financial privacy regulations and never share personal data without consent except as required by law.', ARRAY['privacy', 'data', 'protection', 'compliance'], (SELECT id FROM faq_categories WHERE name = 'Security & KYC'), 3, true),

('Why do I need to complete KYC verification?', 'KYC (Know Your Customer) verification is required by financial regulations to prevent fraud and money laundering. It ensures platform security and enables full access to trading features.', ARRAY['kyc', 'verification', 'compliance', 'regulation'], (SELECT id FROM faq_categories WHERE name = 'Security & KYC'), 4, true),

('What documents do I need for verification?', 'You need a government-issued photo ID (passport, drivers license) and proof of address (utility bill, bank statement) dated within the last 3 months.', ARRAY['documents', 'id', 'verification', 'requirements'], (SELECT id FROM faq_categories WHERE name = 'Security & KYC'), 5, true),

('How long does KYC verification take?', 'Most verifications are processed within 24-48 hours. Complex cases may take up to 5 business days. You will receive email updates on your verification status.', ARRAY['kyc', 'timing', 'processing', 'verification'], (SELECT id FROM faq_categories WHERE name = 'Security & KYC'), 6, true),

-- Technical Support FAQs
('Why am I seeing connection errors?', 'Connection errors may occur due to network issues or high platform traffic. Try refreshing the page, checking your internet connection, or contacting support if issues persist.', ARRAY['connection', 'error', 'network', 'troubleshooting'], (SELECT id FROM faq_categories WHERE name = 'Technical Support'), 1, true),

('How do I update my payment methods?', 'Navigate to Settings > Payment Methods to add, edit, or remove payment options. You can link bank accounts, cards, or crypto wallets for seamless transactions.', ARRAY['payment', 'methods', 'settings', 'update'], (SELECT id FROM faq_categories WHERE name = 'Technical Support'), 2, true),

('Can I use the platform on mobile devices?', 'Yes, the platform is fully responsive and works on all modern mobile browsers. For the best experience, add it to your home screen as a Progressive Web App (PWA).', ARRAY['mobile', 'responsive', 'pwa', 'devices'], (SELECT id FROM faq_categories WHERE name = 'Technical Support'), 3, true),

-- Gold Investment Strategy FAQs
('When is the best time to buy gold?', 'Gold is often considered a hedge against inflation and economic uncertainty. Many investors use dollar-cost averaging to reduce timing risk by making regular purchases regardless of price fluctuations.', ARRAY['timing', 'strategy', 'dca', 'hedge'], (SELECT id FROM faq_categories WHERE name = 'Gold Investing'), 2, true),

('How much of my portfolio should be in gold?', 'Financial advisors often suggest 5-10% of a portfolio in precious metals for diversification. However, allocation depends on your risk tolerance, investment goals, and market outlook.', ARRAY['allocation', 'diversification', 'percentage', 'strategy'], (SELECT id FROM faq_categories WHERE name = 'Gold Investing'), 3, true),

('What factors affect gold prices?', 'Gold prices are influenced by inflation rates, currency strength (especially USD), central bank policies, geopolitical events, supply and demand, and market sentiment toward risk assets.', ARRAY['price', 'factors', 'inflation', 'economics'], (SELECT id FROM faq_categories WHERE name = 'Gold Investing'), 4, true),

-- App Features FAQs
('How does the AI assistant work?', 'The AI assistant provides personalized investment insights, market analysis, and answers to your questions. It accesses real-time market data, educational content, and your portfolio information to offer relevant guidance.', ARRAY['ai', 'assistant', 'insights', 'chat'], (SELECT id FROM faq_categories WHERE name = 'App Features'), 2, true),

('What analytics does the portfolio show?', 'The portfolio displays real-time value, 24-hour changes, allocation percentages, performance charts, and AI-generated insights about your investment trends and market opportunities.', ARRAY['portfolio', 'analytics', 'charts', 'insights'], (SELECT id FROM faq_categories WHERE name = 'App Features'), 3, true),

('How do market alerts work?', 'Set up custom alerts for price movements, portfolio milestones, or market events. Notifications are sent via email and in-app messages to keep you informed of important developments.', ARRAY['alerts', 'notifications', 'price', 'events'], (SELECT id FROM faq_categories WHERE name = 'App Features'), 4, true);

-- Populate comprehensive educational content
INSERT INTO educational_content (title, content, category, difficulty_level, tags, reading_time_minutes, is_featured) VALUES

('Getting Started with Digital Gold', 
'Digital gold represents a revolutionary way to invest in precious metals. Unlike physical gold, digital gold tokens like XAUT are backed by real gold stored in secure vaults but can be traded instantly like cryptocurrency.

**Key Benefits:**
• **Instant Liquidity**: Trade 24/7 without visiting dealers
• **Lower Costs**: No storage or insurance fees
• **Fractional Ownership**: Buy any amount, not just full ounces
• **Global Access**: Trade from anywhere in the world
• **Transparency**: Real-time pricing and holdings verification

**How It Works:**
Each XAUT token represents one troy ounce of London Good Delivery gold bars stored in professional vaults. When you buy XAUT, you own actual gold, not just a promise or certificate.

**Getting Started:**
1. Complete KYC verification for account security
2. Fund your account with USDC or bank transfer
3. Buy your first XAUT tokens through our trading interface
4. Monitor your investment in the portfolio section

Digital gold combines the stability of precious metals with the convenience of modern technology, making it an ideal entry point for new gold investors.',
'Getting Started', 'beginner', ARRAY['digital gold', 'xaut', 'introduction', 'basics'], 8, true),

('Understanding Gold as an Investment', 
'Gold has been a store of value for over 4,000 years, making it one of humanity''s oldest investment assets. Understanding its role in modern portfolios is crucial for successful investing.

**Historical Performance:**
Gold has maintained purchasing power over centuries. While stocks may offer higher returns during bull markets, gold provides stability during economic uncertainty.

**Portfolio Role:**
• **Hedge Against Inflation**: Gold often rises when currency values decline
• **Crisis Protection**: Performs well during economic or political instability  
• **Diversification**: Low correlation with stocks and bonds
• **Currency Hedge**: Protection against dollar weakness

**Investment Approaches:**
• **Dollar-Cost Averaging**: Regular purchases regardless of price
• **Tactical Allocation**: Increasing holdings during uncertainty
• **Core Holding**: Maintaining 5-10% allocation consistently
• **Momentum Trading**: Following price trends (advanced strategy)

**Market Factors:**
Gold prices respond to central bank policies, inflation expectations, geopolitical events, and supply/demand dynamics. Understanding these factors helps make informed decisions.

**Modern Advantages:**
Digital gold platforms eliminate traditional barriers like storage costs, authenticity concerns, and liquidity issues while maintaining all the benefits of gold ownership.',
'Investment Strategy', 'intermediate', ARRAY['gold investment', 'portfolio theory', 'strategy', 'allocation'], 12, true),

('Risk Management in Gold Investing', 
'Like all investments, gold carries risks that must be understood and managed for successful long-term results.

**Price Volatility:**
Gold can experience significant short-term price swings. Daily moves of 2-3% are common, with occasional spikes during crisis periods.

**Opportunity Cost:**
Gold doesn''t pay dividends or interest, creating opportunity cost versus income-producing assets during strong economic growth periods.

**Market Timing Risks:**
Attempting to time gold purchases perfectly is difficult. Dollar-cost averaging helps reduce timing risk by spreading purchases over time.

**Storage and Custody (Traditional Gold):**
Physical gold requires secure storage, insurance, and authentication. Digital gold eliminates these concerns.

**Regulatory Risk:**
Government policies toward gold ownership have changed historically. Digital platforms may face evolving regulations.

**Technology Risk:**
Digital gold platforms depend on technology infrastructure. Choose platforms with strong security and backup systems.

**Liquidity Considerations:**
While gold is generally liquid, extreme market conditions can affect bid-ask spreads and transaction costs.

**Risk Mitigation Strategies:**
• **Diversification**: Don''t over-allocate to any single asset
• **Platform Selection**: Choose regulated, audited platforms
• **Position Sizing**: Limit gold to appropriate portfolio percentage
• **Regular Review**: Monitor allocation and rebalance periodically
• **Education**: Stay informed about market factors affecting gold

**Insurance Value:**
Despite risks, gold''s insurance value during severe market stress often justifies modest allocations in diversified portfolios.',
'Risk Management', 'intermediate', ARRAY['risk management', 'volatility', 'diversification', 'safety'], 11, true),

('Economic Factors Affecting Gold Prices', 
'Gold prices are influenced by complex economic relationships. Understanding these factors helps investors make informed timing and allocation decisions.

**Inflation and Real Rates:**
Real interest rates (nominal rates minus inflation) are gold''s most important driver. When real rates are negative, gold becomes more attractive as it preserves purchasing power without earning interest.

**Central Bank Policy:**
• **Quantitative Easing**: Money printing often supports gold prices
• **Interest Rate Cycles**: Rising rates pressure gold, falling rates support it
• **Forward Guidance**: Fed communications impact gold expectations
• **Reserve Diversification**: Central banks buying gold supports prices

**Currency Dynamics:**
Gold is priced in dollars globally, so USD strength affects accessibility for foreign buyers and overall demand patterns.

**Supply and Demand Fundamentals:**
• **Mine Production**: Annual production around 3,000 tons globally
• **Recycling**: About 1,200 tons annually from jewelry and electronics
• **Investment Demand**: ETFs, bars, coins fluctuate with sentiment
• **Jewelry Demand**: Cultural factors, especially in India and China

**Geopolitical Events:**
Political instability, trade wars, and military conflicts often drive safe-haven demand for gold.

**Market Sentiment Indicators:**
• **Commitment of Traders**: Positioning of speculators vs. commercials
• **Gold/Silver Ratio**: Historical relationships for relative value
• **VIX Correlation**: Fear gauge relationship with gold demand
• **Real Yields**: TIPS yields as gold price predictor

**Seasonal Patterns:**
Gold often strengthens during wedding seasons in Asia and holiday periods when jewelry demand peaks.',
'Market Analysis', 'intermediate', ARRAY['economics', 'market factors', 'analysis', 'fundamentals'], 10, false),

('Advanced Portfolio Strategies with Gold', 
'Sophisticated investors use gold strategically within diversified portfolios to enhance risk-adjusted returns and provide portfolio insurance during market stress.

**Portfolio Theory:**
Modern Portfolio Theory suggests that adding uncorrelated assets like gold can improve the efficient frontier, potentially increasing returns while reducing overall volatility.

**Correlation Analysis:**
• Gold vs. S&P 500: Historically low correlation (0.1-0.2)
• Gold vs. Bonds: Low correlation during normal times
• Gold vs. Dollar: Strong negative correlation (-0.7)
• Gold vs. Commodities: Moderate positive correlation (0.3-0.5)

**Advanced Strategies:**

**Risk Parity Approach:**
Allocate based on risk contribution rather than dollar amounts. Gold''s low volatility relative to stocks means larger allocations may be appropriate.

**Tail Risk Hedging:**
Use gold as insurance against extreme market events. Historical analysis shows gold often performs well during market crashes.

**Momentum and Mean Reversion:**
Combine technical analysis with fundamental factors. Gold exhibits both momentum and mean-reverting characteristics over different timeframes.

**Global Macro Integration:**
Consider gold within a global macro framework, adjusting allocations based on:
• Central bank policy cycles
• Real interest rate environments  
• Currency trends and valuations
• Geopolitical risk assessments

**Rebalancing Considerations:**
• Set clear allocation targets (e.g., 5-15%)
• Rebalance quarterly or when allocations drift 5%+ from targets
• Consider tax implications in taxable accounts
• Use new money for rebalancing when possible

**Performance Measurement:**
Track risk-adjusted returns using Sharpe ratios, maximum drawdown, and correlation with other assets to evaluate gold''s portfolio contribution.',
'Investment Strategy', 'advanced', ARRAY['portfolio management', 'risk management', 'advanced strategy', 'rebalancing'], 15, false),

('Using the AI Assistant for Investment Insights', 
'The AI assistant provides personalized guidance using real-time market data, educational content, and your portfolio information to help optimize your gold investment strategy.

**What the AI Can Help With:**
• **Portfolio Analysis**: Review your current allocation and performance
• **Market Insights**: Understand current market conditions affecting gold
• **Investment Strategy**: Get personalized recommendations based on your goals
• **Educational Guidance**: Learn about gold investing concepts
• **Risk Assessment**: Evaluate your portfolio risk and diversification
• **Timing Guidance**: Understand market factors for decision making

**How to Get the Best Results:**
• **Be Specific**: Ask detailed questions about your investment goals
• **Provide Context**: Share your risk tolerance and investment timeline
• **Ask Follow-ups**: Dig deeper into recommendations you receive
• **Regular Check-ins**: Use the AI for ongoing portfolio reviews

**Example Questions to Ask:**
• "How is my portfolio performing compared to gold price movements?"
• "What market factors should I consider before making my next purchase?"
• "How does my current allocation align with my risk tolerance?"
• "What are the key economic indicators affecting gold prices this week?"

**Privacy and Security:**
All conversations are encrypted and your personal information is protected. The AI uses aggregated market data and general investment principles, not sensitive account details.

**Limitations:**
The AI provides educational information and general guidance, not specific financial advice. Always consider your personal circumstances and consult professionals for complex decisions.',
'Technology', 'beginner', ARRAY['ai assistant', 'technology', 'guidance', 'portfolio analysis'], 7, true);