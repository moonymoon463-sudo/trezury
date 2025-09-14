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
import BuyGoldConfirmation from "./pages/BuyGoldConfirmation";
import SellGold from "./pages/SellGold";
import SellGoldAmount from "./pages/SellGoldAmount";
import SellGoldPayout from "./pages/SellGoldPayout";
import SellGoldConfirmation from "./pages/SellGoldConfirmation";
import Swap from "./pages/Swap";
import Wallet from "./pages/Wallet";
import BuySellHub from "./pages/BuySellHub";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import TransactionSuccess from "./pages/TransactionSuccess";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import FundingMethods from "./pages/FundingMethods";

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
            <Route path="/buy-sell-hub" element={
              <ProtectedRoute>
                <BuySellHub />
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
            <Route path="/buy-gold/confirmation" element={
              <ProtectedRoute>
                <BuyGoldConfirmation />
              </ProtectedRoute>
            } />
            <Route path="/sell-gold" element={
              <ProtectedRoute>
                <SellGold />
              </ProtectedRoute>
            } />
            <Route path="/sell-gold/amount" element={
              <ProtectedRoute>
                <SellGoldAmount />
              </ProtectedRoute>
            } />
            <Route path="/sell-gold/payout" element={
              <ProtectedRoute>
                <SellGoldPayout />
              </ProtectedRoute>
            } />
            <Route path="/sell-gold/confirmation" element={
              <ProtectedRoute>
                <SellGoldConfirmation />
              </ProtectedRoute>
            } />
            <Route path="/swap" element={
              <ProtectedRoute>
                <Swap />
              </ProtectedRoute>
            } />
            <Route path="/wallet" element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            } />
            <Route path="/transactions" element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            } />
            <Route path="/transaction-detail/:id" element={
              <ProtectedRoute>
                <TransactionDetail />
              </ProtectedRoute>
            } />
            <Route path="/transactions/success" element={
              <ProtectedRoute>
                <TransactionSuccess />
              </ProtectedRoute>
            } />
            <Route path="/funding-methods" element={
              <ProtectedRoute>
                <FundingMethods />
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
