import type { ReactNode } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { bootstrapTheme } from "@/config/theme";
import { queryClient } from "@/lib/query-client";

/**
 * Composes every app-wide provider in one place. Order matters: theme on the
 * outside, then data layer, then router. `AntApp` enables antd's static
 * `message`/`notification`/`modal` APIs that respect the theme.
 */
const AppProviders = ({ children }: { children: ReactNode }) => (
  <ConfigProvider theme={bootstrapTheme}>
    <AntApp>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </AntApp>
  </ConfigProvider>
);

export default AppProviders;
