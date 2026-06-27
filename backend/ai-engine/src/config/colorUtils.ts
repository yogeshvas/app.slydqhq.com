function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Linear-mixes two hex colors. weight=0 -> color1, weight=1 -> color2.
function mix(hex1: string, hex2: string, weight: number): string {
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  return toHex(
    r1 + (r2 - r1) * weight,
    g1 + (g2 - g1) * weight,
    b1 + (b2 - b1) * weight
  );
}

// A soft pastel background tint suitable for card fills.
export function tint(hex: string): string {
  return mix(hex, "#FFFFFF", 0.88);
}

// A noticeably lighter shade of the same hue, for palette rotation.
export function lighten(hex: string): string {
  return mix(hex, "#FFFFFF", 0.32);
}

// A noticeably darker shade of the same hue, for palette rotation.
export function darken(hex: string): string {
  return mix(hex, "#000000", 0.22);
}

export const HEX_PATTERN = /^#?[0-9A-Fa-f]{6}$/;

export function normalizeHex(hex: string): string {
  const h = hex.startsWith("#") ? hex : `#${hex}`;
  return h.toUpperCase();
}
