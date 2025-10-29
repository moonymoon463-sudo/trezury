/**
 * Alchemy Account Kit Configuration
 * For Synthetix Accounts with embedded wallet support
 */

import { createConfig, AlchemyAccountsUIConfig } from "@account-kit/react";
import { alchemy, base } from "@account-kit/infra";
import { toast } from "sonner";

// IMPORTANT: Replace this with your actual Alchemy API key for Base network
// Get your key from: https://dashboard.alchemy.com
// This is client-exposed by design; security is via Alchemy's allowlisted origins
const API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "YOUR_ACTUAL_ALCHEMY_KEY";

// Warn if placeholder is still present
if (API_KEY === "YOUR_ACTUAL_ALCHEMY_KEY") {
  setTimeout(() => {
    toast.error('Alchemy API key not configured', {
      description: 'Replace YOUR_ACTUAL_ALCHEMY_KEY in config.ts or set VITE_ALCHEMY_API_KEY in .env',
      duration: 10000,
    });
  }, 2000);
}

// UI configuration for email OTP authentication
const uiConfig: AlchemyAccountsUIConfig = {
  auth: {
    sections: [
      [
        {
          type: "email",
          emailMode: "otp",
        },
      ],
    ],
  },
};

// Note: For production, add your Alchemy API key as VITE_ALCHEMY_API_KEY in your .env
// The demo key has rate limits and may cause intermittent auth issues
// Get your key from: https://dashboard.alchemy.com
export const alchemyConfig = createConfig(
  {
    transport: alchemy({ 
      apiKey: API_KEY
    }),
    chain: base,
    ssr: false,
    enablePopupOauth: true,
  },
  uiConfig
);
