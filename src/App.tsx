import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PWAProvider } from "@/hooks/usePWA";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import { InstallPrompt } from "@/components/InstallPrompt";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import LandingPage from "@/components/LandingPage";
import Index from "./pages/Index";
import BuyGold from "./pages/BuyGold";
import BuyGoldAmount from "./pages/BuyGoldAmount";
import BuyGoldAsset from "./pages/BuyGoldAsset";
import BuyGoldQuote from "./pages/BuyGoldQuote";
import BuyGoldConfirmation from "./pages/BuyGoldConfirmation";
import SellGold from "./pages/SellGold";
import OffRampReturn from "./pages/OffRampReturn";
import Swap from "./pages/Swap";
import Wallet from "./pages/Wallet";
import BuySellHub from "./pages/BuySellHub";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import TransactionSuccess from "./pages/TransactionSuccess";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import FundingMethods from "./pages/FundingMethods";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import KYCVerification from "./pages/KYCVerification";
import PaymentMethods from "./pages/PaymentMethods";
import AddPaymentMethod from "./pages/AddPaymentMethod";
import AddUSDC from "./pages/AddUSDC";
import AdminFees from "./pages/AdminFees";
import AdminFeesNew from "./pages/AdminFeesNew";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSetup from "./pages/AdminSetup";
import AdminUsers from "./pages/AdminUsers";
import AdminKYC from "./pages/AdminKYC";
import AdminTransactions from "./pages/AdminTransactions";
import WalletManagement from "./pages/WalletManagement";
import Portfolio from "./pages/Portfolio";
import TrzryReserves from "./pages/TrzryReserves";
import Send from "./pages/Send";
import Receive from "./pages/Receive";

const queryClient = new QueryClient();

// App Routes Component that uses auth context
const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Loading...</h2>
        </div>
      </div>
    );
  }

  // Show landing page for non-authenticated users
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }

  // Show app routes for authenticated users
  return (
    <Routes>
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/auth" element={<Index />} />
      <Route path="/buy-sell-hub" element={<ProtectedRoute><BuySellHub /></ProtectedRoute>} />
      <Route path="/buy-gold" element={<ProtectedRoute><BuyGold /></ProtectedRoute>} />
      <Route path="/buy-gold/amount" element={<ProtectedRoute><BuyGoldAmount /></ProtectedRoute>} />
      <Route path="/buy-gold/asset" element={<ProtectedRoute><BuyGoldAsset /></ProtectedRoute>} />
      <Route path="/buy-gold/quote" element={<ProtectedRoute><BuyGoldQuote /></ProtectedRoute>} />
      <Route path="/buy-gold/confirmation" element={<ProtectedRoute><BuyGoldConfirmation /></ProtectedRoute>} />
      <Route path="/sell-gold" element={<ProtectedRoute><SellGold /></ProtectedRoute>} />
      <Route path="/offramp/return" element={<ProtectedRoute><OffRampReturn /></ProtectedRoute>} />
      <Route path="/swap" element={<ProtectedRoute><Swap /></ProtectedRoute>} />
      <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/transaction-detail/:id" element={<ProtectedRoute><TransactionDetail /></ProtectedRoute>} />
      <Route path="/transactions/success" element={<ProtectedRoute><TransactionSuccess /></ProtectedRoute>} />
      <Route path="/funding-methods" element={<ProtectedRoute><FundingMethods /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/kyc-verification" element={<ProtectedRoute><KYCVerification /></ProtectedRoute>} />
      <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethods /></ProtectedRoute>} />
      <Route path="/add-payment-method" element={<ProtectedRoute><AddPaymentMethod /></ProtectedRoute>} />
      <Route path="/add-usdc" element={<ProtectedRoute><AddUSDC /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/setup" element={<ProtectedRoute><AdminSetup /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/kyc" element={<ProtectedRoute><AdminKYC /></ProtectedRoute>} />
      <Route path="/admin/transactions" element={<ProtectedRoute><AdminTransactions /></ProtectedRoute>} />
      <Route path="/admin/fees" element={<ProtectedRoute><AdminFees /></ProtectedRoute>} />
      <Route path="/admin/fees-external" element={<ProtectedRoute><AdminFeesNew /></ProtectedRoute>} />
      <Route path="/admin/wallet" element={<ProtectedRoute><WalletManagement /></ProtectedRoute>} />
      <Route path="/trzry-reserves" element={<ProtectedRoute><TrzryReserves /></ProtectedRoute>} />
      <Route path="/send" element={<ProtectedRoute><Send /></ProtectedRoute>} />
      <Route path="/receive" element={<ProtectedRoute><Receive /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PWAProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AppRoutes />
            <InstallPrompt />
            <UpdatePrompt />
            <OfflineIndicator />
          </BrowserRouter>
        </TooltipProvider>
      </PWAProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
