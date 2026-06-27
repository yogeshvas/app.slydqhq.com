import { tint, lighten, darken } from "./colorUtils";
import type { AccentOverride } from "./accentColors";

export type ThemeName = "corporate" | "funky" | "minimal" | "academic";

export interface ThemeTokens {
  background: string;
  darkPanelBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  cardBg: string;
  // Single primary accent + its light tint — used for badges, tinted cards, rings, icons.
  accent: string;
  accentTint: string;
  accentPalette: string[];
  challengePalette: string[];
  fontHeading: string;
  fontBody: string;
  fontImportUrl: string;
  cardRadius: string;
  // Builds the DALL-E style descriptor — takes the resolved accent override (if any) so
  // generated illustrations can reflect a custom brand color, not just the theme default.
  imageStyleDescriptor: (accent?: AccentOverride | null) => string;
}

// "corporate" is the default — a clean modern SaaS look: bold sans type, generous
// whitespace, one consistent indigo accent used sparingly against black/white/gray.
export const THEMES: Record<ThemeName, ThemeTokens> = {
  corporate: {
    background: "#FAF9F6",
    darkPanelBg: "#FFFFFF",
    textPrimary: "#0D0D0D",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    border: "#E5E7EB",
    cardBg: "#FAFAFA",
    accent: "#6366F1",
    accentTint: "#EEF0FF",
    accentPalette: ["#6366F1", "#818CF8", "#4F46E5", "#6366F1", "#818CF8", "#4F46E5"],
    challengePalette: ["#4F46E5", "#6366F1", "#818CF8", "#4F46E5", "#6366F1", "#818CF8"],
    fontHeading: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontBody: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontImportUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap",
    cardRadius: "12px",
    imageStyleDescriptor: (accent) => {
      const colorWord = accent?.name ?? "indigo";
      const colorHex = accent?.hex ?? "#6366F1";
      return "Style: polished isometric 3D-style illustration with soft directional studio lighting, subtle ambient-occlusion " +
        "shadows, and gentle depth of field. Clean glass and brushed-metal materials with a touch of glossy highlight. " +
        `Color palette: cool blue-grey base tones accented with glowing ${colorWord} (${colorHex}) highlights. ` +
        "Quality: premium modern SaaS / fintech product-marketing illustration, highly polished, professionally rendered.";
    },
  },
  funky: {
    background: "#FFFFFF",
    darkPanelBg: "#FFFFFF",
    textPrimary: "#18122B",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    border: "#ECE9F7",
    cardBg: "#FAF9FF",
    accent: "#FF5A5F",
    accentTint: "#FFEDEE",
    accentPalette: ["#FF5A5F", "#7C3AED", "#F59E0B", "#0EA5E9", "#10B981", "#EC4899"],
    challengePalette: ["#7C3AED", "#FF5A5F", "#0EA5E9", "#F59E0B", "#EC4899", "#10B981"],
    fontHeading: "'Sora', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontBody: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontImportUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
    cardRadius: "20px",
    imageStyleDescriptor: (accent) => {
      if (accent) {
        return "Style: polished isometric 3D-style illustration with bold directional lighting, glossy plastic and glass " +
          "materials, playful exaggerated proportions, dynamic diagonal composition. " +
          `Color palette: saturated ${accent.name} (${accent.hex}) tones with bright highlight glows. ` +
          "Quality: energetic, premium modern startup/social-media product illustration, highly polished.";
      }
      return "Style: polished isometric 3D-style illustration with bold directional lighting, glossy plastic and glass materials, " +
        "playful exaggerated proportions, dynamic diagonal composition. " +
        "Color palette: saturated coral (#FF5A5F), violet, amber, sky blue, and emerald with bright highlight glows. " +
        "Quality: energetic, premium modern startup/social-media product illustration, highly polished.";
    },
  },
  minimal: {
    background: "#FFFFFF",
    darkPanelBg: "#FFFFFF",
    textPrimary: "#0A0A0A",
    textSecondary: "#525252",
    textMuted: "#A3A3A3",
    border: "#E5E5E5",
    cardBg: "#FAFAFA",
    accent: "#171717",
    accentTint: "#F2F2F2",
    accentPalette: ["#171717", "#171717", "#171717", "#171717", "#171717", "#171717"],
    challengePalette: ["#171717", "#171717", "#171717", "#171717", "#171717", "#171717"],
    fontHeading: "'Manrope', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontBody: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontImportUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
    cardRadius: "2px",
    imageStyleDescriptor: (accent) => {
      const colorPhrase = accent ? `a single subtle ${accent.name} (${accent.hex}) accent` : "no color accent";
      return "Style: minimalist line art, single-weight outline illustration, generous negative space, almost no fill, " +
        "soft single-source lighting suggested only through subtle line weight variation. " +
        `Color palette: black or charcoal line work on a white background with ${colorPhrase}. ` +
        "Quality: refined, editorial, restrained, gallery-poster level polish.";
    },
  },
  academic: {
    background: "#FFFDF8",
    darkPanelBg: "#FFFFFF",
    textPrimary: "#1F2A24",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    border: "#E2DFD6",
    cardBg: "#FAF8F3",
    accent: "#1E3A5F",
    accentTint: "#EEF1F5",
    accentPalette: ["#1E3A5F", "#7A2E3B", "#5B6B4F", "#1E3A5F", "#7A2E3B", "#5B6B4F"],
    challengePalette: ["#7A2E3B", "#1E3A5F", "#5B6B4F", "#7A2E3B", "#1E3A5F", "#5B6B4F"],
    fontHeading: "'Source Serif 4', Georgia, 'Times New Roman', serif",
    fontBody: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    fontImportUrl: "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700;800&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
    cardRadius: "6px",
    imageStyleDescriptor: (accent) => {
      const colorPalette = accent ? `${accent.name} (${accent.hex}) tones` : "navy, burgundy, and sage green";
      return "Style: editorial diagram illustration with soft directional lighting and fine outline detail, muted flat shapes, " +
        "calm and academic feel, subtle paper-grain texture. " +
        `Color palette: ${colorPalette} on an off-white background. ` +
        "Quality: polished, textbook/research-report level, professionally rendered.";
    },
  },
};

export function resolveTheme(theme?: string): ThemeName {
  return theme && theme in THEMES ? (theme as ThemeName) : "corporate";
}

// Swaps a theme's accent/tint/palette for a custom color while keeping its font,
// spacing, radius, and base text/background identity intact.
export function applyAccentOverride(theme: ThemeTokens, override: AccentOverride | null): ThemeTokens {
  if (!override) return theme;
  const { hex } = override;
  return {
    ...theme,
    accent: hex,
    accentTint: tint(hex),
    accentPalette: [hex, lighten(hex), darken(hex), hex, lighten(hex), darken(hex)],
    challengePalette: [darken(hex), hex, lighten(hex), darken(hex), hex, lighten(hex)],
  };
}
