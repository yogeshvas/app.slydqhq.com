import { HEX_PATTERN, normalizeHex } from "./colorUtils";

export const ACCENT_PRESETS: Record<string, string> = {
  blue: "#2563EB",
  green: "#16A34A",
  purple: "#7C3AED",
  amber: "#D97706",
  rose: "#E11D48",
  teal: "#0D9488",
};

export interface AccentOverride {
  name: string; // preset name, or the hex itself when custom
  hex: string;
}

// Accepts a preset name ("blue") or a hex code ("#2563EB" / "2563EB").
// Returns null for anything unrecognized — callers should fall back to the theme default.
export function resolveAccentOverride(input?: string): AccentOverride | null {
  if (!input) return null;
  const trimmed = input.trim();
  const presetHex = ACCENT_PRESETS[trimmed.toLowerCase()];
  if (presetHex) return { name: trimmed.toLowerCase(), hex: presetHex };
  if (HEX_PATTERN.test(trimmed)) return { name: trimmed, hex: normalizeHex(trimmed) };
  return null;
}
