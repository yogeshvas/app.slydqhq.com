import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted Inter (weights used across the UI).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";
import App from "./App.tsx";
import AppProviders from "@/providers/AppProviders";
import { captureRefCode } from "@/features/referral/api/referral.api";

// Stash a ?ref=CODE from the landing/signup URL so it survives the auth round-trip.
captureRefCode();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
