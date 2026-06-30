import { lazy, Suspense } from "react";
import { Spin } from "antd";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import { paths } from "./paths";

// Code-split every page so the initial bundle stays small as the app grows.
const LandingPage = lazy(
  () => import("@/features/marketing/pages/LandingPage"),
);
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const SignupPage = lazy(() => import("@/features/auth/pages/SignupPage"));
const GoogleCallbackPage = lazy(
  () => import("@/features/auth/pages/GoogleCallbackPage"),
);
const DashboardPage = lazy(
  () => import("@/features/dashboard/pages/DashboardPage"),
);
const CreatePage = lazy(() => import("@/features/decks/pages/CreatePage"));
const GeneratePage = lazy(() => import("@/features/decks/pages/GeneratePage"));
const OutlineReviewPage = lazy(
  () => import("@/features/decks/pages/OutlineReviewPage"),
);
const DeckViewerPage = lazy(
  () => import("@/features/decks/pages/DeckViewerPage"),
);
const PublicDeckPage = lazy(
  () => import("@/features/decks/pages/PublicDeckPage"),
);
const PaymentPage = lazy(() => import("@/features/billing/pages/PaymentPage"));
const MediaPage = lazy(() => import("@/features/media/pages/MediaPage"));
const TemplatesPage = lazy(
  () => import("@/features/templates/pages/TemplatesPage"),
);
const LibraryPage = lazy(() => import("@/features/library/pages/LibraryPage"));
const TrashPage = lazy(() => import("@/features/decks/pages/TrashPage"));
const SettingsPage = lazy(
  () => import("@/features/settings/pages/SettingsPage"),
);

const PageFallback = () => (
  <div className="grid min-h-screen place-items-center bg-zinc-50">
    <Spin size="large" />
  </div>
);

const AppRouter = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Public routes */}
      <Route path={paths.home} element={<LandingPage />} />
      <Route path={paths.login} element={<LoginPage />} />
      <Route path={paths.signup} element={<SignupPage />} />
      <Route path={paths.googleCallback} element={<GoogleCallbackPage />} />
      {/* Public deck share viewer — no auth. */}
      <Route path={paths.share} element={<PublicDeckPage />} />

      {/* Authenticated routes — all share the rail + contextual sidebar. */}
      <Route element={<ProtectedRoute />}>
        {/* Clean checkout screen — no app chrome/gradient behind the gateway. */}
        <Route path={paths.payment} element={<PaymentPage />} />
        <Route element={<AppLayout />}>
          <Route path={paths.dashboard} element={<DashboardPage />} />
          <Route path={paths.create} element={<CreatePage />} />
          <Route path={paths.createGenerate} element={<GeneratePage />} />
          <Route path={paths.createOutline} element={<OutlineReviewPage />} />
          <Route path={paths.deck} element={<DeckViewerPage />} />
          <Route path={paths.media} element={<MediaPage />} />
          <Route path={paths.templates} element={<TemplatesPage />} />
          <Route path={paths.library} element={<LibraryPage />} />
          <Route path={paths.trash} element={<TrashPage />} />
          <Route path={`${paths.settings}/*`} element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Unknown routes → public landing page. */}
      <Route path="*" element={<Navigate to={paths.home} replace />} />
    </Routes>
  </Suspense>
);

export default AppRouter;
