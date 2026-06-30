/**
 * Frontend mirror of the ai-engine theme palettes (config/themes.ts) — just the
 * colours we need to preview each theme's look in the Generate page.
 */
export interface ThemePreview {
  value: string;
  label: string;
  description: string;
  bg: string;
  text: string;
  accent: string;
  palette: string[];
  /** Page 1 of a real sample deck in this theme (rendered from public/theme_ppts). */
  image: string;
}

export const THEME_PREVIEWS: ThemePreview[] = [
  {
    value: "corporate",
    label: "Corporate",
    description: "Clean indigo SaaS look",
    bg: "#FAF9F6",
    text: "#0D0D0D",
    accent: "#6366F1",
    palette: ["#6366F1", "#818CF8", "#4F46E5"],
    image: "/theme_ppts/corporate.jpg",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Black & white, editorial",
    bg: "#FFFFFF",
    text: "#0A0A0A",
    accent: "#171717",
    palette: ["#171717", "#525252", "#A3A3A3"],
    image: "/theme_ppts/minimal.jpg",
  },
  {
    value: "funky",
    label: "Funky",
    description: "Bold and colourful",
    bg: "#FFFFFF",
    text: "#18122B",
    accent: "#FF5A5F",
    palette: ["#FF5A5F", "#7C3AED", "#F59E0B", "#0EA5E9", "#10B981"],
    image: "/theme_ppts/funky.jpg",
  },
  {
    value: "academic",
    label: "Academic",
    description: "Muted, scholarly serif",
    bg: "#FFFDF8",
    text: "#1F2A24",
    accent: "#1E3A5F",
    palette: ["#1E3A5F", "#7A2E3B", "#5B6B4F"],
    image: "/theme_ppts/academic.jpg",
  },
];

export const themePreview = (value: string): ThemePreview =>
  THEME_PREVIEWS.find((t) => t.value === value) ?? THEME_PREVIEWS[0];
