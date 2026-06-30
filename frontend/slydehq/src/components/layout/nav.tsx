import type { ComponentType, ReactNode } from "react";
import {
  HomeOutlined,
  PictureOutlined,
  SettingOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { paths } from "@/routes/paths";
import HomeSidebar from "./sidebars/HomeSidebar";
import SettingsSidebar from "./sidebars/SettingsSidebar";

/**
 * Primary navigation, data-driven so new sections are a one-line addition.
 * `secondary` is the contextual panel rendered next to the rail for that
 * section (omit for sections that use the full content width).
 * `match` decides when the rail item is highlighted for the current path.
 */
export interface RailSection {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  secondary?: ComponentType;
  match: (pathname: string) => boolean;
}

const startsWith = (prefix: string) => (p: string) => p.startsWith(prefix);

export const railSections: RailSection[] = [
  {
    key: "home",
    label: "Home",
    icon: <HomeOutlined />,
    path: paths.dashboard,
    secondary: HomeSidebar,
    // Home owns the dashboard, the create flow, deck viewing, and trash.
    match: (p) =>
      p.startsWith(paths.dashboard) ||
      p.startsWith("/decks") ||
      p.startsWith(paths.create) ||
      p.startsWith(paths.trash) ||
      p.startsWith(paths.apiGenerated),
  },
  {
    key: "media",
    label: "Media",
    icon: <PictureOutlined />,
    path: paths.media,
    match: startsWith(paths.media),
  },
  {
    key: "billing",
    label: "Billing",
    icon: <WalletOutlined />,
    path: paths.billing,
    secondary: SettingsSidebar,
    // Owns the billing page specifically (listed before Settings so it wins).
    match: startsWith(paths.billing),
  },
  {
    key: "settings",
    label: "Settings",
    icon: <SettingOutlined />,
    path: paths.settings,
    secondary: SettingsSidebar,
    // Everything under /settings EXCEPT billing (which has its own rail item).
    match: (p) => p.startsWith(paths.settings) && !p.startsWith(paths.billing),
  },
];

/** The active section for a given pathname (defaults to Home). */
export function activeSection(pathname: string): RailSection {
  return railSections.find((s) => s.match(pathname)) ?? railSections[0];
}
