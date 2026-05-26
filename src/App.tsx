import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { BottomNav } from "@/components/layout/BottomNav";
import { SplashScreen } from "@/components/common/SplashScreen";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import Index from "./pages/Index";
import Discover from "./pages/Discover";
import Create from "./pages/Create";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import NewMessage from "./pages/NewMessage";
import NotFound from "./pages/NotFound";
import UserProfile from "./pages/UserProfile";
import Boost from "./pages/Boost";
import LiveSetup from "./pages/LiveSetup";
import LiveBroadcast from "./pages/LiveBroadcast";
import LiveViewer from "./pages/LiveViewer";
import LiveStats from "./pages/LiveStats";
import MyInfo from "./pages/MyInfo";
import Login from "./pages/auth/Login";
import MyShop from "./pages/MyShop";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Marketplace from "./pages/Marketplace";
import GroupBuy from "./pages/GroupBuy";
import HelpSupport from "./pages/HelpSupport";
import SellerSales from "./pages/SellerSales";
import SellerWallet from "./pages/SellerWallet";
import Register from "./pages/auth/Register";
import VerifyOTP from "./pages/auth/VerifyOTP";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AuthCallback from "./pages/auth/AuthCallback";
import CompleteProfile from "./pages/auth/CompleteProfile";

const queryClient = new QueryClient();

const AUTH_PATHS = ['/auth'];

const AppContent = () => {
  const location = useLocation();
  const { user, loading } = useAuth();

  const hideNavPaths = ['/create', '/settings', '/messages', '/chat', '/live', '/auth'];
  const hideNav = hideNavPaths.some(path => location.pathname.startsWith(path));

  // Redirect to login if not authenticated (sauf pages auth)
  const isAuthPage = location.pathname.startsWith('/auth');
  if (!loading && !user && !isAuthPage) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <>
      <Routes>
        {/* Auth routes */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/verify-otp" element={<VerifyOTP />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/complete-profile" element={<CompleteProfile />} />

        {/* App routes */}
        <Route path="/" element={<Index />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/create" element={<Create />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/my-info" element={<MyInfo />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/new" element={<NewMessage />} />
        <Route path="/chat/:conversationId" element={<Chat />} />
        <Route path="/user/:userId" element={<UserProfile />} />
        <Route path="/boost" element={<Boost />} />
        <Route path="/live/setup" element={<LiveSetup />} />
        <Route path="/my-shop" element={<MyShop />} />
        <Route path="/ma-boutique" element={<MyShop />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:orderId" element={<OrderDetail />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/group-buy" element={<GroupBuy />} />
        <Route path="/seller-sales" element={<SellerSales />} />
        <Route path="/seller-wallet" element={<SellerWallet />} />
        <Route path="/help-support" element={<HelpSupport />} />
        {/* Route aliases for convenience */}
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/register" element={<Navigate to="/auth/register" replace />} />
        <Route path="/help" element={<Navigate to="/help-support" replace />} />
        <Route path="/my-space" element={<Navigate to="/profile" replace />} />
        <Route path="/profile/:username/shop" element={<MyShop />} />
        <Route path="/live/broadcast" element={<LiveBroadcast />} />
        <Route path="/live/view/:creatorId" element={<LiveViewer />} />
        <Route path="/live/stats" element={<LiveStats />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideNav && user && <BottomNav />}
    </>
  );
};

const App = () => {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
          <BrowserRouter>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
