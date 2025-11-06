import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: [
      "@ethersproject/hardware-wallets",
      "@ledgerhq/hw-app-eth",
      "@ledgerhq/hw-transport",
      "@ledgerhq/hw-transport-node-hid",
      "@ledgerhq/hw-transport-node-hid-noevents",
      "node-hid"
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      external: [
        "@ethersproject/hardware-wallets",
        "@ledgerhq/hw-app-eth",
        "@ledgerhq/hw-transport-node-hid",
        "node-hid"
      ].filter(() => true)
    }
  }
}));
