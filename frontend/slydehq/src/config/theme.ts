import { theme, type ThemeConfig } from "antd";

// Bootstrap 5 semantic palette — base + :hover + :active shades, taken from
// Bootstrap's compiled button CSS so the buttons match pixel-for-pixel.
export const bs = {
  primary: { base: "#0d6efd", hover: "#0b5ed7", active: "#0a58ca" },
  secondary: { base: "#6c757d", hover: "#5c636a", active: "#565e64" },
  success: { base: "#198754", hover: "#157347", active: "#146c43" },
  danger: { base: "#dc3545", hover: "#bb2d3b", active: "#b02a37" },
  warning: { base: "#ffc107", hover: "#ffca2c", active: "#ffcd39" },
  info: { base: "#0dcaf0", hover: "#31d2f2", active: "#3dd5f3" },
  light: { base: "#f8f9fa", hover: "#d3d4d5", active: "#c6c7c8" },
  dark: { base: "#212529", hover: "#1c1f23", active: "#1a1e21" },
} as const;

export type BsVariant = keyof typeof bs;

// Slyde HQ brand — indigo. Used for primary buttons, links, and active states.
// base + :hover + :active (darker on press).
export const brand = {
  base: "#4F46E5",
  hover: "#4338CA",
  active: "#3730A3",
} as const;

// Bootstrap uses dark text on these light backgrounds (white is illegible).
export const bsDarkText: BsVariant[] = ["warning", "info", "light"];

// The global antd theme, tuned to Bootstrap's defaults.
export const bootstrapTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm, // Bootstrap's default is the LIGHT theme
  token: {
    colorPrimary: brand.base,
    colorSuccess: bs.success.base,
    colorWarning: bs.warning.base,
    colorError: bs.danger.base,
    colorInfo: bs.info.base,
    colorLink: brand.base,
    colorLinkHover: brand.hover,

    colorTextBase: "#212529", // Bootstrap body color
    colorBgBase: "#ffffff",
    colorBorder: "#dee2e6", // Bootstrap border-color

    fontFamily: "'Inter', sans-serif",
    fontSize: 16, // Bootstrap base = 1rem
    // Rounded look (trial — flip these back to 0 for the original sharp corners).
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    borderRadiusXS: 6,
    controlHeight: 38, // default Bootstrap button/input height
    wireframe: false,
  },
  components: {
    Button: {
      fontWeight: 500,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
      paddingInline: 16,
      paddingInlineLG: 22,
      paddingInlineSM: 12,
      controlHeightLG: 48, // btn-lg
      controlHeightSM: 31, // btn-sm
      defaultColor: "#212529",
      defaultBorderColor: "#ced4da",
      // Pill-shaped buttons — "fully rounded".
      borderRadius: 999,
      borderRadiusLG: 999,
      borderRadiusSM: 999,
    },
    Input: {
      controlHeight: 38,
      paddingInline: 14,
      borderRadius: 10,
      hoverBorderColor: "#a1a1aa",
      activeBorderColor: brand.base,
      // Focus ring, tinted to the brand (indigo).
      activeShadow: "0 0 0 0.25rem rgba(79,70,229,.18)",
    },
    Segmented: { borderRadius: 999, borderRadiusSM: 999 },
    Card: { borderRadiusLG: 14 },
  },
};
