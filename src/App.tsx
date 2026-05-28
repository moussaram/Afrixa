import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { BottomNav } from "@/components/layout/BottomNav";
import { SplashScreen } from "@/components/common/SplashScreen";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/useAuth";
import { lazy, Suspense, useState } from "react";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const Discover = lazy(() => import("./pages/Discover"));
const Create = lazy(() => import("./pages/Create"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Messages = lazy(() => import("./pages/Messages"));
const Chat = lazy(() => import("./pages/Chat"));
const NewMessage = lazy(() => import("./pages/NewMessage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Boost = lazy(() => import("./pages/Boost"));
const LiveSetup = lazy(() => import("./pages/LiveSetup"));
const LiveBroadcast = lazy(() => import("./pages/LiveBroadcast"));
const LiveViewer = lazy(() => import("./pages/LiveViewer"));
const LiveStats = lazy(() => import("./pages/LiveStats"));
const MyInfo = lazy(() => import("./pages/MyInfo"));
const Login = lazy(() => import("./pages/auth/Login"));
const MyShop = lazy(() => import("./pages/MyShop"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const GroupBuy = lazy(() => import("./pages/GroupBuy"));
const HelpSupport = lazy(() => import("./pages/HelpSupport"));
const SellerSales = lazy(() => import("./pages/SellerSales"));
const SellerWallet = lazy(() => import("./pages/SellerWallet"));
const Register = lazy(() => import("./pages/auth/Register"));
const VerifyOTP = lazy(() => import("./pages/auth/VerifyOTP"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/auth/AuthCallback"));
const CompleteProfile = lazy(() => import("./pages/auth/CompleteProfile"));
const Onboarding = lazy(() => import("./pages/onboarding/Onboarding"));
const UploadVideo = lazy(() => import("./pages/UploadVideo"));
const SearchAdvanced = lazy(() => import("./pages/SearchAdvanced"));
const Sounds = lazy(() => import("./pages/Sounds"));
const Premium = lazy(() => import("./pages/Premium"));
const Coins = lazy(() => import("./pages/Coins"));
const AdsManager = lazy(() => import("./pages/AdsManager"));
const CreatorProgramPage = lazy(() => import("./pages/creators/CreatorProgramPage"));
const AfrixaStudioPage = lazy(() => import("./pages/creators/AfrixaStudioPage"));
const CreatorWalletPage = lazy(() => import("./pages/creators/CreatorWalletPage"));
const ChallengesPage = lazy(() => import("./pages/creators/ChallengesPage"));
const SeriesPage = lazy(() => import("./pages/creators/SeriesPage"));
const FanClubPage = lazy(() => import("./pages/creators/FanClubPage"));
const CollabsPage = lazy(() => import("./pages/creators/CollabsPage"));
const SpotlightPage = lazy(() => import("./pages/creators/SpotlightPage"));

const AppContent = () => {
  const location = useLocation();
  const { user, loading } = useAuth();

  const hideNavPaths = ['/create', '/settings', '/messages', '/chat', '/live', '/auth', '/onboarding'];
  const hideNav = hideNavPaths.some(path => location.pathname.startsWith(path));

  // Redirect to login if not authenticated (sauf pages auth)
  const isAuthPage = location.pathname.startsWith('/auth');
  if (!loading && !user && !isAuthPage) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <>
      <Suspense fallback={null}>
        <Routes>
          {/* Auth routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/verify-otp" element={<VerifyOTP />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/complete-profile" element={<CompleteProfile />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/upload-video" element={<UploadVideo />} />
          <Route path="/search" element={<SearchAdvanced />} />
          <Route path="/sounds" element={<Sounds />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/coins" element={<Coins />} />
          <Route path="/ads" element={<AdsManager />} />

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
          <Route path="/creators/program" element={<CreatorProgramPage />} />
          <Route path="/creators/studio" element={<AfrixaStudioPage />} />
          <Route path="/creators/wallet" element={<CreatorWalletPage />} />
          <Route path="/creators/challenges" element={<ChallengesPage />} />
          <Route path="/creators/series" element={<SeriesPage />} />
          <Route path="/creators/fan-club" element={<FanClubPage />} />
          <Route path="/creators/collabs" element={<CollabsPage />} />
          <Route path="/creators/spotlight" element={<SpotlightPage />} />
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
      </Suspense>
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
          <OfflineBanner />
          <Toaster />
          <Sonner />
          {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
          <BrowserRouter>
            <AuthProvider>
              <AppContent />
              <InstallPrompt />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
