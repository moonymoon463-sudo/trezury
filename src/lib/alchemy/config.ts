/**
 * Alchemy Account Kit Configuration
 * For Synthetix Accounts with embedded wallet support
 */

import { createConfig } from "@account-kit/react";
import { alchemy, base } from "@account-kit/infra";

// Note: For production, add your Alchemy API key as VITE_ALCHEMY_API_KEY in your .env
// The demo key has rate limits and may cause intermittent auth issues
// Get your key from: https://dashboard.alchemy.com
export const alchemyConfig = createConfig({
  transport: alchemy({ 
    apiKey: import.meta.env.VITE_ALCHEMY_API_KEY || "demo"
  }),
  chain: base,
  ssr: false,
  enablePopupOauth: true,
});
