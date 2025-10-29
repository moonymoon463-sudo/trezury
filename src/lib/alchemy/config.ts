/**
 * Alchemy Account Kit Configuration
 * For Synthetix Accounts with embedded wallet support
 */

import { createConfig } from "@account-kit/react";
import { alchemy, base } from "@account-kit/infra";
import { toast } from "sonner";

const API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";

// Warn about demo key usage
if (API_KEY === "demo") {
  setTimeout(() => {
    toast.warning('Using Alchemy demo API key', {
      description: 'Add VITE_ALCHEMY_API_KEY to .env for production use',
      duration: 10000,
    });
  }, 2000);
}

// Note: For production, add your Alchemy API key as VITE_ALCHEMY_API_KEY in your .env
// The demo key has rate limits and may cause intermittent auth issues
// Get your key from: https://dashboard.alchemy.com
export const alchemyConfig = createConfig({
  transport: alchemy({ 
    apiKey: API_KEY
  }),
  chain: base,
  ssr: false,
  enablePopupOauth: true,
});
