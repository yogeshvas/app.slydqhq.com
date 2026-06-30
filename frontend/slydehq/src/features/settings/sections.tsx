import type { ReactNode } from "react";
import {
  GiftOutlined,
  KeyOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";

export interface SettingsSection {
  key: string;
  label: string;
  icon: ReactNode;
  /** Absolute route. Overview is the index ("/settings"). */
  path: string;
  pro?: boolean;
}

// Single source of truth for the settings sub-nav and routing. Add a section
// here and it shows up in the sidebar; render it in SettingsPage by key.
export const settingsSections: SettingsSection[] = [
  { key: "overview", label: "Overview", icon: <SettingOutlined />, path: "/settings" },
  { key: "billing", label: "Billing & credits", icon: <WalletOutlined />, path: "/settings/billing" },
  { key: "referral", label: "Refer & earn", icon: <GiftOutlined />, path: "/settings/referral" },
  { key: "members", label: "Members", icon: <TeamOutlined />, path: "/settings/members" },
  {
    key: "api-keys",
    label: "My API keys",
    icon: <KeyOutlined />,
    path: "/settings/api-keys",
    pro: true,
  },
];

/** Resolve the active settings section from a pathname. */
export function activeSettingsSection(pathname: string): SettingsSection {
  // Exact match first so "/settings" doesn't shadow "/settings/members".
  return (
    settingsSections.find((s) => s.path === pathname) ??
    settingsSections.find((s) => s.key !== "overview" && pathname.startsWith(s.path)) ??
    settingsSections[0]
  );
}
