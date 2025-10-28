/**
 * Alchemy Account Kit Configuration
 * For Synthetix Accounts with embedded wallet support
 */

import { createConfig } from "@account-kit/react";
import { alchemy, base } from "@account-kit/infra";

// Note: Replace with your actual Alchemy API key
// For development, you can use demo key but it has limitations
export const alchemyConfig = createConfig({
  transport: alchemy({ 
    // Get from env or use demo for development
    apiKey: "demo"
  }),
  chain: base,
  ssr: false,
  enablePopupOauth: true,
});
