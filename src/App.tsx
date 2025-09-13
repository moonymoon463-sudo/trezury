import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import BuyGold from "./pages/BuyGold";
import BuyGoldAmount from "./pages/BuyGoldAmount";
import BuyGoldAsset from "./pages/BuyGoldAsset";
import BuyGoldQuote from "./pages/BuyGoldQuote";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/buy-gold" element={
              <ProtectedRoute>
                <BuyGold />
              </ProtectedRoute>
            } />
            <Route path="/buy-gold/amount" element={
              <ProtectedRoute>
                <BuyGoldAmount />
              </ProtectedRoute>
            } />
            <Route path="/buy-gold/asset" element={
              <ProtectedRoute>
                <BuyGoldAsset />
              </ProtectedRoute>
            } />
            <Route path="/buy-gold/quote" element={
              <ProtectedRoute>
                <BuyGoldQuote />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
