import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import type { Slide, LayoutType, FlowNode, ChartBar, Phase, SlideMetric, Callout } from "./slide.types";
import { renderDiagramSVG, normalizeSpec, type DiagramTheme } from "./diagram.engine";
import { THEMES, applyAccentOverride, type ThemeName, type ThemeTokens } from "../config/themes";
import { CANVAS_DIMS, type CanvasFormat, type CanvasDims } from "../config/canvas";
import type { AccentOverride } from "../config/accentColors";

const OUTPUT_DIR = path.resolve(process.cwd(), "generated");

// ─── LAYOUTS WITH PHOTOS ───────────────────────────────────────────────────────
// Only cover (hero) and closing (quote_image) fetch Unsplash photos.
// image_left / image_right are used when AI explicitly picks them for case studies.
// text_flow, text_chart, and all diagram layouts never fetch photos.
const PHOTO_LAYOUTS = new Set([
  "hero", "image_left", "image_right", "quote_image", "challenge_grid",
  "social_statement", "social_cta",
]);

const VALID_LAYOUTS = new Set<string>([
  "hero", "image_right", "image_left", "two_column",
  "metrics", "timeline", "architecture", "comparison", "minimal",
  "icon_grid", "challenge_grid", "flow_kpi", "numbered_steps_callout",
  "process_donut", "staggered_phases", "tech_ecosystem",
  "text_chart", "text_flow", "quote_image",
  "dark_steps", "dark_comparison", "dark_flow",
  "concentric_layers", "big_numbers", "split_insight",
  "funnel_stages", "arrow_pipeline", "pyramid_tiers", "circular_flow", "venn_overlap",
  "petal_diagram", "auto_diagram",
  "social_statement", "social_quote", "social_stat", "social_list_card", "social_cta",
]);

const SLIDE_TYPE_FALLBACK: Record<string, LayoutType> = {
  cover:                    "hero",
  market_opportunity:       "text_flow",
  client_challenges:        "challenge_grid",
  solution_overview:        "dark_flow",
  product_capabilities:     "icon_grid",
  technical_architecture:   "concentric_layers",
  business_impact:          "process_donut",
  implementation_timeline:  "staggered_phases",
  pricing:                  "minimal",
  call_to_action:           "quote_image",
  // AI variants
  executive:                "text_chart",
  executive_summary:        "text_chart",
  executive_slide:          "text_chart",
  hidden_costs:             "challenge_grid",
  use_cases:                "dark_steps",
  integration:              "tech_ecosystem",
  roi:                      "big_numbers",
  competitive_advantage:    "split_insight",
  case_study:               "image_left",
  closing:                  "quote_image",
  chapter_intro:            "minimal",
  funnel:                   "funnel_stages",
  pipeline:                 "arrow_pipeline",
  pyramid:                  "pyramid_tiers",
  segmentation:             "pyramid_tiers",
  circular:                 "circular_flow",
  venn:                     "venn_overlap",
  ecosystem:                "venn_overlap",
  capabilities:             "petal_diagram",
  flower:                   "petal_diagram",
  // social_post arc
  hook:                     "social_statement",
  value_point:              "social_list_card",
  insight:                  "social_quote",
  stat_highlight:           "social_stat",
  cta:                      "social_cta",
};

function resolveLayout(slide: Slide): LayoutType {
  if (slide.recommendedLayout && VALID_LAYOUTS.has(slide.recommendedLayout)) {
    // Always use staggered_phases for implementation_timeline — overrides AI picking "timeline"
    if (slide.slideType === "implementation_timeline" && slide.recommendedLayout === "timeline") {
      return "staggered_phases";
    }
    return slide.recommendedLayout as LayoutType;
  }
  // Alternate text_flow / text_chart for market_opportunity by slide number
  if (slide.slideType === "market_opportunity") {
    return (slide.slideNumber ?? 0) % 2 === 0 ? "text_chart" : "text_flow";
  }
  return SLIDE_TYPE_FALLBACK[slide.slideType] ?? "minimal";
}

// ─── UTILITIES ─────────────────────────────────────────────────────────────────
function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseBullet(text: string): { title: string; desc: string } {
  const idx = text.indexOf(": ");
  if (idx > 2 && idx < 65) {
    return { title: cap(text.slice(0, idx)), desc: cap(text.slice(idx + 2)) };
  }
  return { title: "", desc: cap(text) };
}

function esc(s: any): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function label(tag?: string): string {
  if (!tag) return "";
  return `<p class="label">${esc(tag)}</p>`;
}

function parsePercent(v: string | number): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : Math.abs(n);
}

// ─── INLINE SVG ICONS (Lucide-style, 24×24 viewBox) ──────────────────────────
const ICONS: Record<string, string> = {
  smartphone:        `<path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
  users:             `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  zap:               `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  shield:            `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  "message-circle":  `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  "check-circle":    `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  clock:             `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  "trending-up":     `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  database:          `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
  lock:              `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  globe:             `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  headphones:        `<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>`,
  "dollar-sign":     `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
  "refresh-cw":      `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  layers:            `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
  cpu:               `<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>`,
  bell:              `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  settings:          `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  "bar-chart":       `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  star:              `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  "arrow-right":     `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
  "chevron-right":   `<polyline points="9 18 15 12 9 6"/>`,
  check:             `<polyline points="20 6 9 17 4 12"/>`,
  phone:             `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.79 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.7 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.27a16 16 0 0 0 6.29 6.29l1.04-1.04a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`,
  mail:              `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
  send:              `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,
  user:              `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  "user-check":      `<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>`,
  "credit-card":     `<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
  "trending-down":   `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>`,
  "bar-chart-2":     `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  "pie-chart":       `<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>`,
  server:            `<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>`,
  cloud:             `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>`,
  wifi:              `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`,
  "shield-check":    `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>`,
  calendar:          `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  clipboard:         `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>`,
  "file-text":       `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
  target:            `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  activity:          `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  "alert-triangle":  `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  inbox:             `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
  "message-square":  `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
};

const ICON_POOL = [
  "message-circle", "users", "zap", "shield", "check-circle",
  "trending-up", "database", "lock", "globe", "headphones",
  "dollar-sign", "refresh-cw", "layers", "cpu", "bell",
  "settings", "bar-chart", "star", "smartphone", "clock",
  "phone", "mail", "send", "user-check", "credit-card",
  "server", "cloud", "wifi", "shield-check", "calendar",
  "clipboard", "file-text", "target", "activity", "inbox",
  "message-square", "pie-chart", "trending-down", "alert-triangle", "check",
];

// ── UNIVERSAL JUNK LABEL GUARD ─────────────────────────────────────────────────
// Any title/label the AI writes verbatim from the prompt instructions instead of real content
const JUNK_LABEL_SET = new Set([
  "left","right","left column","right column","left panel","right panel",
  "step","step name","step title","step 1","step 2","step 3","step 4","step 5",
  "feature","feature name","feature 1","feature 2","capability","capability name",
  "challenge name","pain point","issue","problem name",
  "option a","option b","option c","item 1","item 2","item 3","point 1","point 2",
  "layer name","outer layer","inner layer","middle layer",
  "stage name","stage 1","stage 2","phase name","phase 1","phase 2",
  "tier name","tier 1","base tier","top tier",
  "petal name","pillar 1","pillar name",
  "circle name","circle 1","node","node label","label here","label",
  "card title","section","header","column","category name","category",
  "callout name","callout 1","benefit","benefit name",
  "card 1","card 2","card 3","card 4",
]);
function isJunkLabel(s: string | undefined): boolean {
  return !s || JUNK_LABEL_SET.has(s.toLowerCase().trim());
}
// Merge junk title back into description so content isn't lost
function mergeJunk(title: string | undefined, desc: string): string {
  if (!title) return desc;
  return desc ? `${title}: ${desc}` : title;
}

// Active theme's diagram accent colors — set per-request in buildHTML() before
// rendering. Safe under concurrency: buildHTML has no `await` inside it, so it
// runs to completion in one synchronous tick before any other request can run.
let activeAccentPalette: string[] = THEMES.corporate.accentPalette;
let activeAccent: string = THEMES.corporate.accent;
let activeAccentTint: string = THEMES.corporate.accentTint;
let activeTheme: ThemeTokens = THEMES.corporate;

function icon(name: string, size = 20): string {
  const paths = ICONS[name] ?? ICONS["star"];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// ─── SVG CHART HELPERS ─────────────────────────────────────────────────────────

// Split a label into at most 2 lines — never cuts mid-word
function svgLines(text: string, maxChars = 14): [string, string?] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  let line1 = "";
  let line2 = "";
  let filling = 1;
  for (const w of words) {
    if (filling === 1) {
      const candidate = (line1 + " " + w).trim();
      if (candidate.length <= maxChars) {
        line1 = candidate;
      } else {
        filling = 2;
        line2 = w;
      }
    } else {
      const candidate = (line2 + " " + w).trim();
      // Allow line2 up to maxChars; stop adding words once full
      if (candidate.length <= maxChars) {
        line2 = candidate;
      }
    }
  }
  return line2 ? [line1, line2] : [line1];
}

function renderDonutChart(percent: number, valueLabel: string, descLabel: string, desc?: string): string {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(percent, 0), 100);
  const dash = (pct / 100) * circ;
  const gap = circ - dash;
  const accent = activeAccent;
  // Auto-size font: shorter = bigger
  const vLen = valueLabel.length;
  const vFs = vLen <= 4 ? 22 : vLen <= 7 ? 17 : vLen <= 10 ? 14 : 11;
  // If label is long, split into 2 lines
  const vLines = svgLines(valueLabel, 8);
  const vY1 = vLines.length > 1 ? 66 : 74;
  const vY2 = vY1 + vFs + 2;
  return `<div class="donut-wrap">
  <svg viewBox="0 0 140 140" width="130" height="130">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="${activeAccentTint}" stroke-width="11"/>
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="${accent}" stroke-width="11"
      stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
      stroke-dashoffset="${(circ * 0.25).toFixed(1)}"
      stroke-linecap="round"/>
    <text x="70" y="${vY1}" text-anchor="middle" font-size="${vFs}" font-weight="800" fill="${accent}">${esc(vLines[0] ?? "")}</text>
    ${vLines[1] ? `<text x="70" y="${vY2}" text-anchor="middle" font-size="${vFs}" font-weight="800" fill="${accent}">${esc(vLines[1])}</text>` : ""}
  </svg>
  <p class="donut-label">${esc(cap(descLabel))}</p>
  ${desc ? `<p class="donut-desc">${esc(desc)}</p>` : ""}
</div>`;
}

function renderBarChart(bars: ChartBar[]): string {
  if (!bars || bars.length === 0) return "";
  const max = Math.max(...bars.map(b => b.value), 1);
  // Shade highest bar with full accent, lower bars with decreasing opacity
  const opacities = [1, 0.75, 0.55, 0.4, 0.28, 0.18];
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  const rankMap = new Map(sorted.map((b, i) => [b.label, i]));
  // The 0/25/50/75/100 axis only makes sense when every bar is a true percentage —
  // bars carrying a displayValue represent some other unit (counts, currency, etc.).
  const isPercentageChart = bars.every(b => !b.displayValue);
  return `<div class="bar-chart">
  <div class="bar-chart-inner">
    <div class="bar-rows">
      ${bars.map(b => {
        const pct = Math.round((b.value / max) * 100);
        const rank = rankMap.get(b.label) ?? 0;
        const opacity = opacities[Math.min(rank, opacities.length - 1)] ?? 0.18;
        const shade = rank === 0 ? activeAccent : `color-mix(in srgb, ${activeAccent} ${Math.round(opacity * 100)}%, #E5E7EB)`;
        const valColor = rank === 0 ? "#fff" : activeAccent;
        return `<div class="bar-row">
          <span class="bar-lbl">${esc(b.label)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${shade}">
              <span class="bar-inner-val" style="color:${valColor}">${esc(b.displayValue ?? `${b.value}%`)}</span>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
    ${isPercentageChart ? `<div class="bar-x-axis">
      <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
    </div>` : ""}
    </div>
  </div>
</div>`;
}

// Curved alternating-arc flow (semicircle arcs connecting numbered circles)
function renderCurvedArcFlow(nodes: FlowNode[]): string {
  if (!nodes || nodes.length === 0) return "";
  const n = Math.min(nodes.length, 5);
  // Wide canvas — more room per node = labels won't overlap
  const W = 1000, H = 180;
  const r = 36;
  const spacing = W / (n + 1);
  const cy = H / 2;

  let paths = "";
  for (let i = 0; i < n - 1; i++) {
    const x1 = spacing * (i + 1) + r;
    const x2 = spacing * (i + 2) - r;
    const midX = (x1 + x2) / 2;
    const arcH = 38;
    const dir = i % 2 === 0 ? -1 : 1; // alternate up/down
    paths += `<path d="M ${x1} ${cy} Q ${midX} ${cy + dir * arcH} ${x2} ${cy}"
      fill="none" stroke="#93C5FD" stroke-width="2" stroke-dasharray="6 3"/>`;
  }

  const circles = Array.from({ length: n }, (_, i) => {
    const x = spacing * (i + 1);
    const icoName = nodes[i]?.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    const icoPaths = ICONS[icoName] ?? ICONS["check-circle"] ?? "";
    const labelLines = svgLines(nodes[i]?.label ?? "", 17);
    const subLines = nodes[i]?.sublabel ? svgLines(nodes[i]!.sublabel!, 15) : [];
    const labelY1 = r * 2 + 24;
    const labelY2 = labelY1 + 15;
    const subY = (labelLines.length > 1 ? labelY2 : labelY1) + 14;
    const fillColor = activeAccentPalette[i % activeAccentPalette.length] ?? "#1E3A5F";
    return `<g transform="translate(${x - r},${cy - r})">
      <circle cx="${r}" cy="${r}" r="${r}" fill="${fillColor}" stroke="${fillColor}" stroke-width="1.5"/>
      <svg x="${r - 13}" y="${r - 13}" width="26" height="26" viewBox="0 0 24 24"
        fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icoPaths}
      </svg>
      <text x="${r}" y="${labelY1}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[0])}</text>
      ${labelLines[1] ? `<text x="${r}" y="${labelY2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[1])}</text>` : ""}
      ${subLines[0] ? `<text x="${r}" y="${subY}" text-anchor="middle" font-size="9" fill="#6B7280" font-family="Inter,sans-serif">${esc(subLines[0])}</text>` : ""}
    </g>`;
  }).join("");

  const totalH = H + 85;
  return `<div class="curved-arc-flow">
  <svg viewBox="0 0 ${W} ${totalH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    ${paths}
    ${circles}
  </svg>
</div>`;
}

const CALLOUT_STYLES: Record<Callout["type"], { bg: string; fg: string; icon: string }> = {
  warning: { bg: "#FEF9C3", fg: "#854D0E", icon: "alert-triangle" },
  danger:  { bg: "#FEE2E2", fg: "#991B1B", icon: "alert-triangle" },
  success: { bg: "#DCFCE7", fg: "#166534", icon: "check-circle" },
  info:    { bg: "#E0E7FF", fg: "#3730A3", icon: "check-circle" },
};

// Shared callout-box row used below stat/metric layouts for risk/success highlights
function renderCallouts(callouts?: Callout[]): string {
  const items = (callouts ?? []).filter(c => c?.title || c?.description).slice(0, 2);
  if (items.length === 0) return "";
  return `<div class="callout-row">
    ${items.map(c => {
      const s = CALLOUT_STYLES[c.type] ?? CALLOUT_STYLES.info;
      return `<div class="callout-box" style="background:${s.bg}">
        <div class="callout-icon" style="color:${s.fg}">${icon(s.icon, 18)}</div>
        <p class="callout-text" style="color:${s.fg}"><strong>${esc(c.title)}:</strong> ${esc(c.description)}</p>
      </div>`;
    }).join("")}
  </div>`;
}

// ─── LAYOUT RENDERERS ──────────────────────────────────────────────────────────

// ── COVER (hero) ───────────────────────────────────────────────────────────────
function renderHero(slide: Slide): string {
  return `<div class="slide cover">
  <div class="cover-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
  <div class="cover-body">
    <div class="cover-inner">
      ${label(slide.headerTag)}
      <h1 class="cover-title">${esc(slide.title ?? "")}</h1>
      <div class="cover-rule"></div>
      ${slide.subtitle ? `<p class="cover-subtitle">${esc(slide.subtitle)}</p>` : ""}
      ${slide.description ? `<p class="cover-meta">${esc(slide.description)}</p>` : ""}
    </div>
  </div>
</div>`;
}

// Shared "feature row" block used by image_left/image_right: small icon + bold
// title + description, stacked with generous gaps — no box, border, or divider.
function renderFeatureRows(bullets: string[]): string {
  return `<div class="feat-rows-clean">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const ico = ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
      const fTitle = !isJunkLabel(p.title) ? p.title : undefined;
      return `<div class="feat-row-clean">
        <div class="frc-icon" style="color:${activeAccent}">${icon(ico, 20)}</div>
        <div class="frc-text">
          ${fTitle ? `<p class="frc-title">${esc(fTitle)}</p>` : ""}
          <p class="frc-desc">${esc(fTitle ? p.desc : mergeJunk(p.title, p.desc))}</p>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// ── IMAGE LEFT ─────────────────────────────────────────────────────────────────
function renderImageLeft(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (!slide.title && !slide.description && !slide.subtitle && bullets.length === 0) return renderMinimal(slide);
  return `<div class="slide il">
  <div class="il-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
  <div class="il-body">
    ${label(slide.headerTag)}
    <h2 class="section-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="body-text italic">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? renderFeatureRows(bullets) : ""}
  </div>
</div>`;
}

// ── IMAGE RIGHT ────────────────────────────────────────────────────────────────
function renderImageRight(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (!slide.title && !slide.description && !slide.subtitle && bullets.length === 0) return renderMinimal(slide);
  return `<div class="slide ir">
  <div class="ir-body">
    ${label(slide.headerTag)}
    <h2 class="section-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="body-text italic">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? renderFeatureRows(bullets) : ""}
  </div>
  <div class="ir-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
</div>`;
}

// ── TWO COLUMN (clean white, no dark header) ────────────────────────────────────
const TC_JUNK_TITLES = new Set([
  "left column", "right column", "left", "right", "column",
  "card", "item", "point", "section", "header", "title",
]);

function renderTwoColumn(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  if (bullets.length === 0) return renderMinimal(slide);
  return `<div class="slide two-col">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="feat-grid">
    ${bullets.map((b) => {
      const p = parseBullet(b);
      const titleIsJunk = !p.title || TC_JUNK_TITLES.has(p.title.toLowerCase().trim());
      // If the AI smuggled "Left Column: ... | Right Column: ..." into desc, strip the pipe half
      const cleanDesc = p.desc.replace(/\s*\|\s*right column[:\s]*.*/i, "").replace(/\s*\|\s*left column[:\s]*.*/i, "").trim();
      const displayTitle = titleIsJunk ? "" : p.title;
      const displayDesc  = titleIsJunk && p.title
        ? `${p.title}: ${cleanDesc}`   // merge junk title back into the sentence
        : cleanDesc;
      return `<div class="feat-card" style="background:${activeAccentTint}">
        ${displayTitle ? `<p class="feat-title">${esc(displayTitle)}</p>` : ""}
        <p class="feat-desc">${esc(displayDesc)}</p>
      </div>`;
    }).join("")}
  </div>
</div>`;
}

// ── ARCHITECTURE (clean white, accent border sidebar) ──────────────────────────
function renderArchitecture(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (bullets.length === 0) return renderMinimal(slide);
  return `<div class="slide arch">
  <div class="arch-sidebar">
    ${label(slide.headerTag)}
    <h2 class="arch-sidebar-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="arch-sidebar-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="arch-main">
    <div class="feat-rows">
      ${bullets.map((b, i) => {
        const p = parseBullet(b);
        return `<div class="feat-row">
          <span class="feat-row-num">${String(i + 1).padStart(2, "0")}</span>
          <div class="feat-row-content">
            ${!isJunkLabel(p.title) ? `<p class="feat-row-title">${esc(p.title!)}</p>` : ""}
            <p class="feat-row-desc">${esc(isJunkLabel(p.title) ? mergeJunk(p.title, p.desc) : p.desc)}</p>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
</div>`;
}

// ── COMPARISON (dark table) ────────────────────────────────────────────────────
function renderComparison(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 9);

  // If still empty after hydration, synthesize rows from description
  if (bullets.length === 0 && slide.description) {
    const parts = slide.description.split(/[.!?;]+/).map(s => s.trim()).filter(s => s.length > 10).slice(0, 6);
    if (parts.length >= 2) bullets = parts;
  }

  // Ultimate fallback: redirect to minimal if we truly have nothing
  if (bullets.length === 0) return renderMinimal(slide);

  const parts = slide.subtitle?.includes("|")
    ? slide.subtitle.split("|").map(s => s.trim())
    : ["Without Solution", "With Our Solution"];
  const [leftTitle, rightTitle] = parts;

  // Detect table format: "Feature: left | right"
  const isTable = bullets.some(b => b.includes(" | "));

  if (isTable) {
    const rows = bullets.map(b => {
      const colonIdx = b.indexOf(": ");
      if (colonIdx > 0) {
        const feature = b.slice(0, colonIdx).trim();
        const rest = b.slice(colonIdx + 2);
        const pipeIdx = rest.indexOf(" | ");
        return pipeIdx > 0
          ? { feature, left: rest.slice(0, pipeIdx).trim(), right: rest.slice(pipeIdx + 3).trim() }
          : { feature, left: rest.trim(), right: "" };
      }
      const pipeIdx = b.indexOf(" | ");
      return pipeIdx > 0
        ? { feature: b.slice(0, pipeIdx).trim(), left: "", right: b.slice(pipeIdx + 3).trim() }
        : { feature: b, left: "", right: "" };
    });

    return `<div class="slide dark-comp-slide">
  ${label(slide.headerTag) ? `<p class="dark-label">${esc(slide.headerTag ?? "")}</p>` : ""}
  <h2 class="dark-comp-title">${esc(slide.title ?? "")}</h2>
  ${slide.description ? `<p class="dark-comp-desc">${esc(slide.description)}</p>` : ""}
  <div class="dark-comp-table-wrap">
    <table class="dark-comp-table">
      <thead>
        <tr>
          <th class="dct-th-feat">Capability</th>
          <th class="dct-th-bad">${esc(leftTitle ?? "Without")}</th>
          <th class="dct-th-good">${esc(rightTitle ?? "With Solution")}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `<tr class="dct-tr">
          <td class="dct-td-feat">${esc(r.feature)}</td>
          <td class="dct-td-bad">${esc(r.left)}</td>
          <td class="dct-td-good">${esc(r.right)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
  ${slide.description?.includes("Note:") || bullets.length === 0 ? "" : ""}
</div>`;
  }

  // Fallback: two-column layout (dark themed)
  const half = Math.ceil(bullets.length / 2);
  const leftBullets = bullets.slice(0, half);
  const rightBullets = bullets.slice(half);
  return `<div class="slide dark-comp-slide">
  ${label(slide.headerTag) ? `<p class="dark-label">${esc(slide.headerTag ?? "")}</p>` : ""}
  <h2 class="dark-comp-title">${esc(slide.title ?? "")}</h2>
  ${slide.description ? `<p class="dark-comp-desc">${esc(slide.description)}</p>` : ""}
  <div class="dark-comp-cols">
    <div class="dark-comp-col dark-comp-col-left">
      <p class="dark-comp-col-hdr">${esc(leftTitle ?? "")}</p>
      ${leftBullets.map(b => {
        const p = parseBullet(b);
        return `<div class="dark-comp-row"><span class="dco-x">✗</span><div>${p.title ? `<strong>${esc(p.title)}</strong> — ` : ""}${esc(p.desc)}</div></div>`;
      }).join("")}
    </div>
    <div class="dark-comp-col dark-comp-col-right">
      <p class="dark-comp-col-hdr">${esc(rightTitle ?? "")}</p>
      ${rightBullets.map(b => {
        const p = parseBullet(b);
        return `<div class="dark-comp-row"><span class="dco-check">✓</span><div>${p.title ? `<strong>${esc(p.title)}</strong> — ` : ""}${esc(p.desc)}</div></div>`;
      }).join("")}
    </div>
  </div>
</div>`;
}

// ── METRICS ────────────────────────────────────────────────────────────────────
function renderMetrics(slide: Slide): string {
  let metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 4);
  // Synthesize metrics from bulletPoints if AI forgot to provide them
  if (metrics.length === 0) {
    metrics = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4).map(b => {
      const p = parseBullet(b);
      return { value: p.title || "—", label: p.desc || p.title || "" };
    });
  }
  if (metrics.length === 0) return renderMinimal(slide);
  const descs = (slide.bulletPoints ?? []).filter(Boolean);
  const imageRight = (slide.slideNumber ?? 0) % 2 !== 0;
  return `<div class="slide metrics-slide${imageRight ? " reverse" : ""}">
  ${slide.imageUrl ? `<div class="metrics-photo" style="background-image:url('${esc(slide.imageUrl)}')"></div>` : ""}
  <div class="metrics-body">
    ${label(slide.headerTag)}
    <h2 class="section-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="metrics-list">
      ${metrics.map((m, i) => `<div class="metric-item">
        <p class="metric-val">${esc(m.value)}</p>
        <p class="metric-lbl">${esc(cap(m.label))}</p>
        ${descs[i] ? `<p class="metric-desc">${esc(cap(descs[i]))}</p>` : ""}
      </div>`).join("")}
    </div>
  </div>
</div>`;
}

// ── TIMELINE ───────────────────────────────────────────────────────────────────
function renderTimeline(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  if (bullets.length === 0) return renderMinimal(slide);
  return `<div class="slide steps">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="steps-grid">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      return `<div class="step-cell">
        <p class="step-num" style="color:${activeAccent}">0${i + 1}</p>
        <div class="step-rule" style="background:${activeAccent}"></div>
        ${p.title ? `<p class="step-title">${esc(p.title)}</p>` : ""}
        <p class="step-desc">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
</div>`;
}

// ── MINIMAL ────────────────────────────────────────────────────────────────────
function renderMinimal(slide: Slide): string {
  const highlights = (slide.bulletPoints ?? []).filter(Boolean);
  const imageRight = (slide.slideNumber ?? 0) % 2 !== 0;
  // Defensive: if AI gave us nothing at all, derive a title from slideType
  const title = slide.title || (slide.slideType ? cap(slide.slideType.replace(/_/g, " ")) : "");
  const desc = slide.description || (highlights.length > 0 ? "" : slide.subtitle ?? "");
  // A list of pricing tiers / facts reads badly centered — only center true
  // statement/quote slides (no image, no list) where there's little text to anchor.
  const centerStatement = !slide.imageUrl && highlights.length === 0;
  return `<div class="slide minimal${imageRight ? " reverse" : ""}">
  ${slide.imageUrl ? `<div class="minimal-photo" style="background-image:url('${esc(slide.imageUrl)}')"></div>` : ""}
  <div class="minimal-body ${centerStatement ? "no-image" : ""}">
    ${label(slide.headerTag)}
    <h1 class="minimal-title">${esc(title)}</h1>
    ${centerStatement ? `<div class="minimal-title-accent"></div>` : ""}
    ${slide.subtitle && slide.subtitle !== desc ? `<p class="minimal-sub">${esc(slide.subtitle)}</p>` : ""}
    ${desc ? `<p class="body-text">${esc(desc)}</p>` : ""}
    ${highlights.length > 0 ? `<div class="highlight-list">
      ${highlights.map(h => {
        const p = parseBullet(h);
        const hTitle = !isJunkLabel(p.title) ? p.title : undefined;
        return `<div class="highlight-row" style="border-left:3px solid ${activeAccent};background:${activeAccentTint}">
          <p class="highlight-text">${hTitle ? `<strong>${esc(hTitle)}</strong> — ` : ""}${esc(hTitle ? p.desc : mergeJunk(p.title, p.desc))}</p>
        </div>`;
      }).join("")}
    </div>` : ""}
  </div>
</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// NEW LAYOUTS
// ══════════════════════════════════════════════════════════════════════════════

// ── ICON GRID ──────────────────────────────────────────────────────────────────
function renderIconGrid(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 6);
  const cols = Math.min(bullets.length, 4);
  return `<div class="slide icon-grid-slide">
  <div class="white-header ig-header">
    <div class="ig-header-left">
      ${label(slide.headerTag)}
      <h2 class="page-title">${esc(slide.title ?? "")}</h2>
      ${slide.subtitle ? `<p class="body-text colored">${esc(slide.subtitle)}</p>` : ""}
    </div>
    ${slide.description ? `<div class="ig-header-right"><p class="ig-desc">${esc(slide.description)}</p></div>` : ""}
  </div>
  <div class="icon-grid" style="grid-template-columns:repeat(${cols},1fr)">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const ico = ICON_POOL[i % ICON_POOL.length] ?? "star";
      return `<div class="icon-card">
        <div class="ic-icon" style="color:${activeAccent}">${icon(ico, 30)}</div>
        <div class="ic-card-body">
          ${!isJunkLabel(p.title) ? `<p class="icon-card-title">${esc(p.title!)}</p>` : ""}
          <p class="icon-card-desc">${esc(isJunkLabel(p.title) ? mergeJunk(p.title, p.desc) : p.desc)}</p>
        </div>
      </div>`;
    }).join("")}
  </div>
</div>`;
}


// ── CHALLENGE GRID ─────────────────────────────────────────────────────────────
function renderChallengeGrid(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);

  return `<div class="slide cg-slide">
  <div class="cg-left${slide.imageUrl ? "" : " cg-left-full"}">
    <div class="cg-header">
      ${label(slide.headerTag)}
      <h2 class="cg-title">${esc(slide.title ?? "")}</h2>
      ${slide.description ? `<p class="cg-desc">${esc(slide.description)}</p>` : ""}
    </div>
    <div class="cg-cards">
      ${bullets.map((b) => {
        const p = parseBullet(b);
        return `<div class="cg-card" style="background:${activeAccentTint}">
          <div class="cg-card-text">
            ${!isJunkLabel(p.title) ? `<p class="cg-card-title">${esc(p.title!)}</p>` : ""}
            <p class="cg-card-desc">${esc(isJunkLabel(p.title) ? mergeJunk(p.title, p.desc) : p.desc)}</p>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  ${slide.imageUrl ? `<div class="cg-img-panel">
    <img class="cg-img" src="${slide.imageUrl}" alt="">
  </div>` : ""}
</div>`;
}

// ── FLOW + KPI ─────────────────────────────────────────────────────────────────
function renderFlowKpi(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 4);
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 3);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  const flowData: FlowNode[] = nodes.length > 0
    ? nodes
    : bullets.slice(0, 4).map(b => { const p = parseBullet(b); return { label: p.title || p.desc, sublabel: "" }; });

  const nodeCircles = flowData.map((n, i) => {
    const icoName = n.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    const accent = activeAccentPalette[i % activeAccentPalette.length] ?? "#1E3A5F";
    return `<div class="fk-node-wrap">
      <div class="fk-node-circle" style="background:${accent};border-color:${accent};color:#fff">${icon(icoName, 36)}</div>
      <p class="fk-node-label">${esc(n.label)}</p>
      ${n.sublabel ? `<p class="fk-node-sub">${esc(n.sublabel)}</p>` : ""}
    </div>`;
  });

  const connectors = flowData.length > 1
    ? flowData.slice(0, -1).map(() => `<div class="fk-chevron">${icon("chevron-right", 24)}</div>`)
    : [];

  const flowHtml: string[] = [];
  nodeCircles.forEach((c, i) => {
    flowHtml.push(c);
    if (connectors[i]) flowHtml.push(connectors[i]!);
  });

  return `<div class="slide flow-kpi-slide">
  <div class="fk-left">
    ${label(slide.headerTag)}
    <h2 class="fk-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="fk-subtitle">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="fk-desc">${esc(slide.description)}</p>` : ""}
    <div class="fk-flow-band">
      <div class="fk-nodes-row">${flowHtml.join("")}</div>
    </div>
  </div>
  <div class="fk-right">
    ${metrics.length > 0 ? `<p class="kpi-heading">Projected Impact</p>` : ""}
    ${metrics.map((m, i) => `<div class="kpi-row">
      <p class="kpi-val">${esc(m.value)}</p>
      <div class="kpi-text">
        <p class="kpi-lbl">${esc(cap(m.label))}</p>
        ${bullets[i] ? `<p class="kpi-desc">${esc(cap(bullets[i]))}</p>` : ""}
      </div>
    </div>`).join("")}
  </div>
</div>`;
}

// ── NUMBERED STEPS + CALLOUT (dark numbered grid) ─────────────────────────────
function extractFallbackSteps(slide: Slide): string[] {
  const desc = slide.description ?? "";
  // Try comma/semicolon splitting first (often has "A, B, C, and D" lists)
  const commaSplit = desc.split(/[,;]/).map(s => s.trim().replace(/^(and|or)\s+/i, "")).filter(s => s.length > 8);
  if (commaSplit.length >= 3) return commaSplit.slice(0, 4);
  // Fall back to sentence splitting
  const sentences = desc.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
  if (sentences.length >= 2) return sentences.slice(0, 4);
  // Last resort: use subtitle split or the whole description as one item
  const sub = slide.subtitle ?? "";
  if (sub.length > 15) return [sub];
  return [];
}

const DS_JUNK_TITLES = new Set(["left", "right", "step", "point", "item", "title", "header", "section", "column"]);

function renderNumberedStepsCallout(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 5);
  const calloutText = slide.subtitle ?? "";
  return `<div class="slide dark-steps-slide">
  <div class="ds-header">
    ${label(slide.headerTag)}
    <h2 class="ds-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="ds-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="ds-list">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const titleIsJunk = !p.title || DS_JUNK_TITLES.has(p.title.toLowerCase().trim());
      return `<div class="ds-cell">
        <div class="ds-num-badge" style="background:${activeAccentTint};color:${activeAccent}">${i + 1}</div>
        <div class="ds-cell-body">
          ${!titleIsJunk ? `<p class="ds-cell-title">${esc(p.title!)}</p>` : ""}
          <p class="ds-cell-desc">${esc(titleIsJunk && p.title ? `${p.title}: ${p.desc}` : p.desc)}</p>
        </div>
      </div>`;
    }).join("")}
  </div>
  ${calloutText ? `<div class="ds-callout" style="background:${activeAccentTint}">
    <p class="ds-callout-text" style="color:${activeAccent}">${esc(calloutText)}</p>
  </div>` : ""}
</div>`;
}

// ── PROCESS + DONUT CHARTS ─────────────────────────────────────────────────────
function renderProcessDonut(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 3);
  const fallbackMetrics = [
    { label: "Efficiency Gain", value: "60%" },
    { label: "Cost Reduction", value: "40%" },
    { label: "Time Saved", value: "75%" },
  ];
  const displayMetrics = metrics.length > 0 ? metrics : fallbackMetrics;
  return `<div class="slide process-donut-slide">
  <div class="pd-left">
    ${label(slide.headerTag)}
    <h2 class="pd-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="pd-desc">${esc(slide.description)}</p>` : ""}
    <div class="pd-steps">
      ${bullets.map((b, i) => {
        const p = parseBullet(b);
        return `<div class="pd-step">
          <span class="pd-step-num">0${i + 1}</span>
          <div>
            ${!isJunkLabel(p.title) ? `<p class="pd-step-title">${esc(p.title!)}</p>` : ""}
            <p class="pd-step-desc">${esc(isJunkLabel(p.title) ? mergeJunk(p.title, p.desc) : p.desc)}</p>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  <div class="pd-right">
    <p class="pd-impact-label">Business Impact</p>
    <div class="pd-donuts">
      ${displayMetrics.map(m => {
        const pct = parsePercent(m.value);
        return renderDonutChart(pct, m.value, m.label, (m as SlideMetric).description);
      }).join("")}
    </div>
  </div>
</div>`;
}

// ── STAGGERED PHASES ───────────────────────────────────────────────────────────
function renderStaggeredPhases(slide: Slide): string {
  // Use phases[] if provided, fallback to bulletPoints
  const phases: Phase[] = (slide.phases ?? []).filter(Boolean).slice(0, 4);
  const fallbackBullets = (slide.bulletPoints ?? []).filter(Boolean);

  // Use extractFallbackSteps as last resort when both phases[] and bulletPoints[] are empty
  const allBullets = fallbackBullets.length > 0 ? fallbackBullets : extractFallbackSteps(slide);

  // If bulletPoints look like "Phase N: desc", treat each as a phase with a single bullet
  const phaseItems: Phase[] = phases.length > 0 ? phases : allBullets.slice(0, 4).map((b, i) => {
    const p = parseBullet(b);
    const name = p.title || `Phase ${i + 1}`;
    // strip "Phase N" prefix from name if present
    const cleanName = name.replace(/^phase\s+\d+\s*[–-]?\s*/i, "") || name;
    return {
      name: cap(cleanName),
      period: ["Months 1–3", "Months 4–6", "Months 7–10", "Months 11–14"][i] ?? "",
      bullets: p.desc ? p.desc.split(/[.;]/).map(s => s.trim()).filter(Boolean).slice(0, 4) : [],
    };
  });

  if (phaseItems.length === 0) return renderMinimal(slide);

  return `<div class="slide staggered-slide">
  <div class="staggered-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="staggered-body">
    ${phaseItems.map((ph, i) => `<div class="phase-box phase-${i % 2 === 0 ? "left" : "right"}" style="background:${activeAccentTint};border-color:${activeAccent}22">
      <span class="phase-num-badge" style="background:${activeAccent}">${String(i + 1).padStart(2, "0")}</span>
      <p class="phase-name">${esc(ph.name)}</p>
      <p class="phase-period">${esc(ph.period)}</p>
      <ul class="phase-bullets">
        ${(ph.bullets ?? []).slice(0, 4).map(b => `<li>${esc(cap(b))}</li>`).join("")}
      </ul>
    </div>`).join("")}
  </div>
</div>`;
}

// ── TECH ECOSYSTEM ─────────────────────────────────────────────────────────────
function renderTechEcosystem(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 6);
  const disclaimer = slide.subtitle ?? "";
  return `<div class="slide tech-slide">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="tech-grid">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const ico = ICON_POOL[i % ICON_POOL.length] ?? "star";
      return `<div class="tech-card">
        <div class="tech-icon">${icon(ico, 40)}</div>
        <p class="tech-category">${esc(!isJunkLabel(p.title) ? p.title.toUpperCase() : `CATEGORY ${i+1}`)}</p>
        <p class="tech-items">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
  ${disclaimer ? `<div class="tech-disclaimer">☐ ${esc(disclaimer)}</div>` : ""}
</div>`;
}

// ── TEXT + BAR CHART ───────────────────────────────────────────────────────────
function renderMetricKpiStack(metrics: { label: string; value: string }[]): string {
  return `<div class="tc-kpi-stack">
    ${metrics.slice(0, 4).map((m, i) => {
      const accent = activeAccentPalette[i % activeAccentPalette.length] ?? "#1E3A5F";
      return `<div class="tc-kpi-row">
        <p class="tc-kpi-val" style="color:${accent}">${esc(m.value)}</p>
        <p class="tc-kpi-lbl">${esc(cap(m.label))}</p>
      </div>`;
    }).join("")}
  </div>`;
}

function renderTextChart(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  const bars: ChartBar[] = (slide.chartBars ?? []).filter(Boolean).slice(0, 6);
  const fallbackBars = (slide.metrics ?? []).map(m => ({
    label: m.label,
    value: parsePercent(m.value),
    // Metrics aren't necessarily percentages (e.g. "4.2B" population) — keep the
    // original formatted string so the bar doesn't mislabel it with a "%" sign.
    displayValue: /%\s*$/.test(String(m.value ?? "").trim()) ? undefined : String(m.value ?? ""),
  })).filter(b => b.value > 0);
  // Filter zero/NaN values — bar chart with 0% bars is useless
  const validBars = bars.filter(b => typeof b.value === "number" && b.value > 0);
  const chartData = validBars.length > 0 ? validBars : fallbackBars.filter(b => b.value > 0);
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 4);

  // Right panel: prefer bar chart, then kpi stack from metrics, then prominent description
  let rightPanel = "";
  if (chartData.length >= 2) {
    rightPanel = renderBarChart(chartData);
  } else if (metrics.length >= 2) {
    rightPanel = renderMetricKpiStack(metrics);
  } else {
    // If we only have bullets, render them as numbered callouts on the right
    const rightBullets = bullets.slice(0, 4);
    rightPanel = rightBullets.length > 0
      ? `<div class="tc-callout-stack">
          ${rightBullets.map((b, i) => {
            const p = parseBullet(b);
            const accent = activeAccentPalette[i % activeAccentPalette.length] ?? "#1E3A5F";
            return `<div class="tc-callout-item" style="border-left:3px solid ${accent}">
              ${!isJunkLabel(p.title) ? `<p class="tc-callout-title">${esc(p.title!)}</p>` : ""}
              <p class="tc-callout-desc">${esc(isJunkLabel(p.title) ? mergeJunk(p.title, p.desc) : p.desc)}</p>
            </div>`;
          }).join("")}
        </div>`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#D1D5DB;font-size:0.9rem">No data</div>`;
  }

  return `<div class="slide text-chart-slide">
  <div class="tc-left">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="body-text colored">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? `<div class="arrow-list-wrap">
      ${bullets.map(b => {
        const p = parseBullet(b);
        return `<div class="arrow-item">
          <span class="arrow-icon">→</span>
          <div>
            ${p.title ? `<strong>${esc(p.title)}</strong>` : ""}
            ${p.desc ? `<span class="arrow-desc"> ${esc(p.desc)}</span>` : ""}
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}
  </div>
  <div class="tc-right">
    ${rightPanel}
  </div>
</div>`;
}

// ── TEXT + FLOW ────────────────────────────────────────────────────────────────
function renderTextFlow(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 5);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  let flowData: FlowNode[] = nodes.length > 0
    ? nodes
    : bullets.slice(0, 4).map(b => { const p = parseBullet(b); return { label: p.title || p.desc, sublabel: p.desc && p.title ? p.desc.split(" ").slice(0, 3).join(" ") : "" }; });

  // Fallback: derive flow nodes from description sentences when no data
  if (flowData.length === 0 && slide.description) {
    const sentences = slide.description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 4);
    flowData = sentences.map((s, i) => ({
      label: s.split(" ").slice(0, 3).join(" "),
      sublabel: s.split(" ").slice(3, 7).join(" "),
      icon: ICON_POOL[i % ICON_POOL.length] ?? "check-circle",
    }));
  }

  // If truly no content at all, redirect to minimal — don't render an empty flow band
  if (flowData.length === 0 && bullets.length === 0 && !slide.description && !slide.subtitle) {
    return renderMinimal(slide);
  }

  // When sparse (< 2 nodes), use a prominent bullet list fallback instead of an isolated circle
  const flowBandContent = flowData.length >= 2
    ? renderCurvedArcFlow(flowData)
    : `<div class="tf-list-fallback">
        ${bullets.slice(0, 6).map((b, i) => {
          const p = parseBullet(b);
          const accent = activeAccentPalette[i % activeAccentPalette.length] ?? "#1E3A5F";
          return `<div class="tf-list-item">
            <span class="tf-list-num" style="background:${accent}">${String(i + 1).padStart(2, "0")}</span>
            <div>
              ${!isJunkLabel(p.title) ? `<strong class="tf-list-title">${esc(p.title!)}</strong>` : ""}
              ${(p.desc || p.title) ? `<p class="tf-list-desc">${esc(isJunkLabel(p.title) ? mergeJunk(p.title, p.desc) : p.desc)}</p>` : ""}
            </div>
          </div>`;
        }).join("") || `<p class="tf-desc" style="color:#6B7280;font-style:italic">${esc(slide.description ?? slide.subtitle ?? "")}</p>`}
      </div>`;

  return `<div class="slide text-flow-slide">
  <div class="tf-top">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="tf-subtitle">${esc(slide.subtitle)}</p>` : ""}
  </div>
  <div class="tf-flow-band">
    ${flowBandContent}
  </div>
  ${slide.description ? `<div class="tf-bottom"><p class="tf-desc">${esc(slide.description)}</p></div>` : ""}
</div>`;
}

// ── QUOTE + IMAGE (closing) ────────────────────────────────────────────────────
function renderQuoteImage(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 3);
  return `<div class="slide quote-image-slide">
  <div class="qi-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
  <div class="qi-body">
    ${label(slide.headerTag)}
    <h2 class="qi-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<blockquote class="qi-quote">${esc(slide.subtitle)}</blockquote>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? `<div class="qi-bullets">
      ${bullets.map(b => `<p class="qi-bullet">${esc(cap(b))}</p>`).join("")}
    </div>` : ""}
    ${slide.headerTag ? `<div class="qi-tags"><span class="qi-tag">${esc(slide.headerTag)}</span><span class="qi-tag">CONFIDENTIAL &amp; PROPRIETARY</span></div>` : ""}
  </div>
</div>`;
}

// ── CONCENTRIC LAYERS ─────────────────────────────────────────────────────────
function renderConcentricLayers(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 3);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);

  const fallbackLabels = ["Channel Layer", "Platform Layer", "Intelligence Core"];
  const layers: FlowNode[] = fallbackLabels.map((fl, i) => nodes[i] ?? { label: fl, sublabel: "" });

  // Left-biased layout: circles on left half, labels on right
  const CX = 310, CY = 155;
  const radii =  [140, 100, 58];
  // outer = lightest, inner = darkest
  const ringFills   = ["#F3F4F6", "#D1D5DB", "#111111"];
  const ringStrokes = ["#D1D5DB", "#6B7280", "#111111"];

  // Build rings outer→inner (draw largest first)
  const rings = [0, 1, 2].map(i =>
    `<circle cx="${CX}" cy="${CY}" r="${radii[i]}" fill="${ringFills[i]}" stroke="${ringStrokes[i]}" stroke-width="${i === 0 ? 1.5 : 2}"/>`
  ).join("\n      ");

  // Inner ring label (white text centered)
  const innerLabel = layers[2]?.label ?? "";
  const innerCenter = `<text x="${CX}" y="${CY + 5}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff" font-family="Inter,sans-serif">${esc(innerLabel)}</text>`;

  // Callout positions: dots on ring edge, labels on right side
  // All dots on right side of their ring (0° = right, slightly offset vertically)
  const dotAngles = [-35, 0, 38]; // degrees
  const rightX = 530; // label area starts here

  const labelYs = [CY - 90, CY, CY + 95];

  // Guard against AI writing literal placeholder text from the prompt instructions
  const CONC_JUNK = /^(actual layer name|layer name|2-4 word description|brief description|sublabel|placeholder|label here)$/i;

  // Always use light backgrounds for callout boxes — inner ring is dark (#111) so we never use ringFills for boxes
  const BOX_FILLS   = ["#F8FAFC", "#F3F4F6", "#FFFFFF"];
  const BOX_STROKES = ["#D1D5DB", "#9CA3AF", "#6B7280"];

  const callouts = layers.slice(0, 3).map((layer, i) => {
    const r = radii[i] ?? radii[radii.length - 1]!;
    const angle = dotAngles[i] ?? 0;
    const ly = labelYs[i] ?? CY;
    const rad = (angle * Math.PI) / 180;
    const dotX = parseFloat((CX + r * Math.cos(rad)).toFixed(1));
    const dotY = parseFloat((CY + r * Math.sin(rad)).toFixed(1));
    const dotColor = i === 2 ? "#ffffff" : (ringStrokes[i] ?? "#6B7280");
    const lineColor = BOX_STROKES[i] ?? "#9CA3AF";
    const boxFill   = BOX_FILLS[i]   ?? "#F8FAFC";
    const boxStroke = BOX_STROKES[i] ?? "#D1D5DB";
    const labelText = CONC_JUNK.test((layer.label ?? "").trim()) ? "" : (layer.label ?? "");
    const sublabelText = CONC_JUNK.test((layer.sublabel ?? "").trim()) ? "" : (layer.sublabel ?? "");
    const subLines = sublabelText ? svgLines(sublabelText, 22) : [];
    return `
      <line x1="${dotX}" y1="${dotY}" x2="${rightX - 8}" y2="${ly}" stroke="${lineColor}" stroke-width="1.5" stroke-dasharray="4 3"/>
      <circle cx="${dotX}" cy="${dotY}" r="5" fill="${dotColor}" stroke="${lineColor}" stroke-width="2"/>
      <rect x="${rightX}" y="${ly - 22}" width="360" height="${subLines.length > 0 ? 44 : 26}" rx="5" fill="${boxFill}" stroke="${boxStroke}" stroke-width="1.2"/>
      <text x="${rightX + 12}" y="${ly - 5}" text-anchor="start" font-size="13" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(labelText)}</text>
      ${subLines[0] ? `<text x="${rightX + 12}" y="${ly + 12}" text-anchor="start" font-size="10.5" fill="#4B5563" font-family="Inter,sans-serif">${esc(subLines[0])}</text>` : ""}
      ${subLines[1] ? `<text x="${rightX + 12}" y="${ly + 24}" text-anchor="start" font-size="10.5" fill="#4B5563" font-family="Inter,sans-serif">${esc(subLines[1])}</text>` : ""}`;
  }).join("");

  // Cards: guard against "Feature Name" literal placeholder
  const cardItems = bullets.map(b => {
    const p = parseBullet(b);
    const isPlaceholder = /^feature name$/i.test((p.title || "").trim());
    const title = isPlaceholder ? "" : p.title;
    const desc  = p.desc;
    return { title, desc };
  });

  return `<div class="slide conc-slide">
  <div class="conc-header">
    ${label(slide.headerTag)}
    <h2 class="conc-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="conc-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="conc-diagram-wrap">
    <svg viewBox="0 0 960 310" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      ${rings}
      ${innerCenter}
      ${callouts}
    </svg>
  </div>
  <div class="conc-card-grid">
    ${cardItems.map(({ title, desc }) => `<div class="conc-card">
        ${title ? `<p class="conc-card-title">${esc(title)}</p>` : ""}
        <p class="conc-card-desc${title ? "" : " conc-card-desc--solo"}">${esc(desc)}</p>
      </div>`).join("")}
  </div>
</div>`;
}

// ── BIG NUMBERS ────────────────────────────────────────────────────────────────
function renderBigNumbers(slide: Slide): string {
  const stats = (slide.metrics ?? []).filter(m => m.value && m.label).slice(0, 3);
  const fallback = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 3).map(b => {
    const p = parseBullet(b);
    return { label: p.title || "", value: p.desc };
  });
  const items = stats.length >= 2 ? stats : fallback;
  if (items.length === 0) return renderMinimal(slide);

  return `<div class="slide bn-slide">
  <div class="bn-header">
    ${label(slide.headerTag)}
    <h2 class="bn-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="bn-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="bn-stats">
    ${items.map((m) => `<div class="bn-stat">
        <div class="bn-value">${esc(m.value)}</div>
        <div class="bn-label">${esc(m.label)}</div>
        ${("description" in m) && (m as SlideMetric).description ? `<p class="bn-stat-desc">${esc((m as SlideMetric).description!)}</p>` : ""}
      </div>`).join('<div class="bn-divider"></div>')}
  </div>
  ${slide.subtitle ? `<p class="bn-foot">${esc(slide.subtitle)}</p>` : ""}
  ${renderCallouts(slide.callouts)}
</div>`;
}

// ── SPLIT INSIGHT ───────────────────────────────────────────────────────────────
// Titles that the AI sometimes uses literally — strip them and show only the description
const SI_JUNK_TITLES = new Set(["left", "right", "challenge", "solution", "problem", "benefit", "issue", "point"]);

function renderSplitInsight(slide: Slide): string {
  const allBullets = (slide.bulletPoints ?? []).filter(Boolean);
  if (allBullets.length < 2) return renderMinimal(slide);

  // The AI sometimes joins challenge+solution into one "left | right" bullet (the
  // dark_comparison row format) instead of giving separate left/right bullets as
  // instructed. Detect that and split each bullet into its two halves instead of
  // slicing the array in half — otherwise the raw " | " leaks into the rendered text.
  const pipeJoined = allBullets.filter(b => b.includes(" | ")).length >= allBullets.length / 2;
  let leftBullets: string[];
  let rightBullets: string[];
  if (pipeJoined) {
    leftBullets = [];
    rightBullets = [];
    for (const b of allBullets) {
      const idx = b.indexOf(" | ");
      if (idx > 0) {
        leftBullets.push(b.slice(0, idx).trim());
        rightBullets.push(b.slice(idx + 3).trim());
      } else {
        leftBullets.push(b);
      }
    }
  } else {
    const half = Math.ceil(allBullets.length / 2);
    leftBullets  = allBullets.slice(0, half);
    rightBullets = allBullets.slice(half);
  }

  // If subtitle contains " | ", split into left/right headers
  const siParts = (slide.subtitle ?? "").includes(" | ")
    ? (slide.subtitle ?? "").split(" | ")
    : ["The Challenge", "The Solution"];
  const leftHead  = siParts[0] ?? "The Challenge";
  const rightHead = siParts[1] ?? "The Solution";

  const renderItem = (b: string, dotClass: string) => {
    const p = parseBullet(b);
    // If the AI used a generic/junk title, treat the whole thing as description only
    const titleIsJunk = !p.title || SI_JUNK_TITLES.has(p.title.toLowerCase().trim());
    const showTitle  = !titleIsJunk && p.title;
    const showDesc   = titleIsJunk ? (p.title ? `${p.title}: ${p.desc}`.replace(/^:\s*/, "").trim() : p.desc) : p.desc;
    return `<li class="si-item">
      <span class="si-bullet-dot ${dotClass}"></span>
      <span>${showTitle ? `<strong class="si-item-title">${esc(showTitle)}</strong><br>` : ""}<span class="si-item-desc">${esc(showDesc)}</span></span>
    </li>`;
  };

  return `<div class="slide si-slide">
  <div class="si-top">
    ${label(slide.headerTag)}
    <h2 class="si-title">${esc(slide.title ?? "")}</h2>
  </div>
  <div class="si-body">
    <div class="si-left">
      <p class="si-panel-head si-left-head">${esc(leftHead.trim())}</p>
      <ul class="si-list">
        ${leftBullets.map(b => renderItem(b, "si-dot-left")).join("")}
      </ul>
    </div>
    <div class="si-divider"></div>
    <div class="si-right">
      <p class="si-panel-head si-right-head">${esc(rightHead.trim())}</p>
      <ul class="si-list">
        ${rightBullets.map(b => renderItem(b, "si-dot-right")).join("")}
      </ul>
    </div>
  </div>
</div>`;
}

// ── DARK COMPARISON (alias — same renderer, already handles dark) ───────────────
const renderDarkComparison = renderComparison;

// ── DARK STEPS (alias — same renderer, already redesigned to dark) ──────────────
const renderDarkSteps = renderNumberedStepsCallout;

// ── DARK FLOW ──────────────────────────────────────────────────────────────────
function renderDarkFlow(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 5);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  let flowData: FlowNode[] = nodes.length > 0
    ? nodes
    : bullets.slice(0, 5).map(b => { const p = parseBullet(b); return { label: p.title || p.desc, sublabel: p.desc && p.title ? p.desc.split(" ").slice(0, 3).join(" ") : "", icon: ICON_POOL[bullets.indexOf(b) % ICON_POOL.length] }; });

  if (flowData.length === 0 && slide.description) {
    const sentences = slide.description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 5);
    flowData = sentences.map((s, i) => ({
      label: s.split(" ").slice(0, 3).join(" "),
      sublabel: s.split(" ").slice(3, 6).join(" "),
      icon: ICON_POOL[i % ICON_POOL.length] ?? "check-circle",
    }));
  }

  // SVG contains ONLY circles + step numbers + arcs. Labels live in HTML below (no SVG text bugs).
  const n = Math.min(flowData.length, 5);
  const W = 1000, H = 200, r = 62;
  const spacing = W / (n + 1);
  const cy = H / 2;

  let paths = "";
  for (let i = 0; i < n - 1; i++) {
    const x1 = spacing * (i + 1) + r;
    const x2 = spacing * (i + 2) - r;
    const midX = (x1 + x2) / 2;
    const dir = i % 2 === 0 ? -1 : 1;
    paths += `<path d="M ${x1} ${cy} Q ${midX} ${cy + dir * 35} ${x2} ${cy}"
      fill="none" stroke="#CBD5E1" stroke-width="2.5" stroke-dasharray="8 4"/>`;
  }

  const svgCircles = Array.from({ length: n }, (_, i) => {
    const x = spacing * (i + 1);
    const icoName = flowData[i]?.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    const icoPaths = ICONS[icoName] ?? ICONS["check-circle"] ?? "";
    const fillColor = activeAccentPalette[i % activeAccentPalette.length] ?? "#1E3A5F";
    const stepNum = String(i + 1).padStart(2, "0");
    return `<g>
      <text x="${x}" y="${cy - r - 10}" text-anchor="middle" font-size="10" font-weight="700"
        fill="#9CA3AF" font-family="Inter,sans-serif" letter-spacing="2">${stepNum}</text>
      <circle cx="${x}" cy="${cy}" r="${r}" fill="${fillColor}"/>
      <svg x="${x - 18}" y="${cy - 18}" width="36" height="36" viewBox="0 0 24 24"
        fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icoPaths}
      </svg>
    </g>`;
  }).join("");

  // HTML label columns — one per node, width equal, aligned under each circle
  const labelCols = flowData.slice(0, n).map((nd, i) => {
    const col = activeAccentPalette[i % activeAccentPalette.length] ?? "#374151";
    return `<div class="df-label-col">
      <p class="df-node-name" style="color:${col}">${esc(nd.label)}</p>
      ${nd.sublabel ? `<p class="df-node-sub">${esc(nd.sublabel)}</p>` : ""}
    </div>`;
  }).join("");

  return `<div class="slide dark-flow-slide">
  <div class="df-header">
    ${slide.headerTag ? `<p class="dark-label">${esc(slide.headerTag)}</p>` : ""}
    <h2 class="df-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="df-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="df-flow-band">
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      ${paths}
      ${svgCircles}
    </svg>
  </div>
  <div class="df-label-row">${labelCols}</div>
  ${slide.subtitle ? `<p class="df-foot">${esc(slide.subtitle)}</p>` : ""}
</div>`;
}

// ── AUTO DIAGRAM ─────────────────────────────────────────────────────────────
// AI-authored semantic graph → deterministic engine geometry. Falls back to the
// dark_flow template when the spec is missing or too thin to lay out.
function renderAutoDiagram(slide: Slide): string {
  const spec = normalizeSpec(slide.diagramSpec);
  if (!spec) return renderDarkFlow(slide);

  const diagramTheme: DiagramTheme = {
    palette: activeAccentPalette,
    textPrimary: activeTheme.textPrimary,
    textSecondary: activeTheme.textSecondary,
    cardBg: activeTheme.cardBg,
    border: activeTheme.border,
    accent: activeAccent,
    resolveIcon: (name) => (name && ICONS[name] ? ICONS[name]! : ""),
  };

  let svg: string;
  try {
    svg = renderDiagramSVG(spec, diagramTheme);
  } catch {
    return renderDarkFlow(slide);
  }

  return `<div class="slide auto-diagram-slide">
  <div class="ad-header">
    ${slide.headerTag ? `<p class="label">${esc(slide.headerTag)}</p>` : ""}
    <h2 class="ad-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="ad-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="ad-canvas">${svg}</div>
  ${slide.subtitle ? `<p class="ad-foot">${esc(slide.subtitle)}</p>` : ""}
</div>`;
}

// ── FUNNEL STAGES ──────────────────────────────────────────────────────────────
function renderFunnelStages(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  const metrics = (slide.metrics ?? []).filter(Boolean);
  type FItem = { name: string; value: string; desc: string };
  let items: FItem[] = metrics.length >= 2
    ? metrics.slice(0, 4).map(m => ({ name: m.label, value: m.value, desc: "" }))
    : bullets.slice(0, 4).map(b => {
        const p = parseBullet(b);
        return { name: p.title || p.desc, value: p.title ? p.desc : "", desc: "" };
      });
  if (items.length === 0 && slide.description) items = extractFallbackSteps(slide).slice(0, 4).map(s => ({ name: s, value: "", desc: "" }));
  const n = Math.min(items.length, 4);
  if (n === 0) return renderMinimal(slide);

  const W = 460, H_BAND = 82, GAP = 5;
  const cx = W / 2;
  const shrink = Math.floor((W - 120) / n);
  const FCOLORS = ['#1E293B', '#374151', '#4B5563', '#6B7280'];

  const clipDefs = items.slice(0, n).map((_, i) => {
    const topW = W - i * shrink;
    const botW = Math.max(topW - shrink, 80);
    const topY = i * (H_BAND + GAP);
    const botY = topY + H_BAND;
    return `<clipPath id="fn-clip-${i}"><polygon points="${cx-topW/2},${topY} ${cx+topW/2},${topY} ${cx+botW/2},${botY} ${cx-botW/2},${botY}"/></clipPath>`;
  });

  const bands = items.slice(0, n).map((item, i) => {
    const topW = W - i * shrink;
    const botW = Math.max(topW - shrink, 80);
    const topY = i * (H_BAND + GAP);
    const botY = topY + H_BAND;
    const midY = (topY + botY) / 2;
    const availW = (topW + botW) / 2 - 16; // avg band width minus padding
    // Scale font down for narrow bands
    const titleSize = Math.min(13, Math.max(9, Math.floor(availW / 14)));
    const valSize = Math.min(12, Math.max(8, titleSize - 1));
    const col = FCOLORS[i] ?? '#6B7280';
    return `<polygon points="${cx-topW/2},${topY} ${cx+topW/2},${topY} ${cx+botW/2},${botY} ${cx-botW/2},${botY}" fill="${col}"/>
      <text x="${cx}" y="${midY - 7}" text-anchor="middle" font-size="${titleSize}" font-weight="700" fill="white" font-family="system-ui,sans-serif" clip-path="url(#fn-clip-${i})">${esc(item.name)}</text>
      ${item.value ? `<text x="${cx}" y="${midY + 13}" text-anchor="middle" font-size="${valSize}" fill="rgba(255,255,255,0.85)" font-family="system-ui,sans-serif" clip-path="url(#fn-clip-${i})">${esc(item.value)}</text>` : ""}`;
  });

  return `<div class="slide fn-slide">
  <div class="fn-left">
    ${label(slide.headerTag)}
    <h2 class="fn-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="fn-desc">${esc(slide.description)}</p>` : ""}
    <div class="fn-legend">
      ${items.slice(0, n).map((item, i) => `<div class="fn-leg-row">
        <span class="fn-dot" style="background:${FCOLORS[i] ?? '#6B7280'}"></span>
        <div class="fn-leg-text">
          <span class="fn-leg-name">${esc(item.name)}</span>
          ${item.value ? `<span class="fn-leg-val">${esc(item.value)}</span>` : ""}
        </div>
      </div>`).join("")}
    </div>
    ${slide.subtitle ? `<p class="fn-foot">${esc(slide.subtitle)}</p>` : ""}
  </div>
  <div class="fn-right">
    <svg viewBox="0 0 ${W} ${n*(H_BAND+GAP)}" xmlns="http://www.w3.org/2000/svg" class="fn-svg">
      <defs>${clipDefs.join("")}</defs>
      ${bands.join("\n      ")}
    </svg>
  </div>
</div>`;
}

// ── ARROW PIPELINE ─────────────────────────────────────────────────────────────
function renderArrowPipeline(slide: Slide): string {
  let steps = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (steps.length === 0) steps = (slide.flowNodes ?? []).map(n => `${n.label}${n.sublabel ? `: ${n.sublabel}` : ""}`).slice(0, 5);
  if (steps.length === 0) steps = extractFallbackSteps(slide).slice(0, 5);
  const n = Math.min(steps.length, 5);
  if (n === 0) return renderMinimal(slide);

  return `<div class="slide ap-slide">
  <div class="ap-header">
    ${label(slide.headerTag)}
    <h2 class="ap-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="ap-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="ap-arrows ap-n${n}">
    ${steps.slice(0, n).map((b, i) => {
      const p = parseBullet(b);
      const col = activeAccentPalette[i % activeAccentPalette.length] ?? '#374151';
      const isFirst = i === 0;
      return `<div class="ap-arrow${isFirst ? " ap-first" : ""}" style="background:${col}">
        <span class="ap-num">0${i + 1}</span>
        <p class="ap-step-title">${esc(!isJunkLabel(p.title) ? (p.title || p.desc) : mergeJunk(p.title, p.desc))}</p>
        ${!isJunkLabel(p.title) && p.title && p.desc ? `<p class="ap-step-desc">${esc(p.desc)}</p>` : ""}
      </div>`;
    }).join("")}
  </div>
  ${slide.subtitle ? `<div class="ap-callout">${esc(slide.subtitle)}</div>` : ""}
</div>`;
}

// ── PYRAMID TIERS ──────────────────────────────────────────────────────────────
function renderPyramidTiers(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 5);
  // items[0] = bottom tier (widest, mass), items[N-1] = top tier (narrowest, premium)
  const items = bullets.map(b => parseBullet(b));
  const N = Math.max(3, Math.min(items.length, 5));

  const COLOR_SETS: Record<number, string[]> = {
    3: ['#553C9A', '#C27803', '#C53030'],
    4: ['#553C9A', '#276749', '#C27803', '#C53030'],
    5: ['#553C9A', '#2C7A7B', '#276749', '#C27803', '#C53030'],
  };
  const colors = COLOR_SETS[N] ?? COLOR_SETS[5]!;

  const VW = 700, VH = 460;
  const APEX_X = VW / 2, APEX_Y = 12;
  const BASE_Y = VH - 10;
  const TOTAL_H = BASE_Y - APEX_Y;
  const MAX_HALF_W = VW / 2 - 8;
  const bandH = TOTAL_H / N;

  const hw = (y: number) => ((y - APEX_Y) / TOTAL_H) * MAX_HALF_W;
  const lx = (y: number) => APEX_X - hw(y);
  const rx = (y: number) => APEX_X + hw(y);

  // Full pyramid outline for clip-path — clips text to stay inside triangle
  const clipId = "py-clip";
  const outlinePoints = `${APEX_X},${APEX_Y} ${rx(BASE_Y)},${BASE_Y} ${lx(BASE_Y)},${BASE_Y}`;

  const tiersSVG = Array.from({ length: N }, (_, i) => {
    const y1 = APEX_Y + i * bandH;
    const y2 = y1 + bandH;
    const midY = (y1 + y2) / 2;

    // Use width at 30% into the band — narrowest safe zone for the foreignObject
    const safeY = i === 0 ? y1 + 0.45 * bandH : y1 + 0.15 * bandH;
    const safeW = rx(safeY) - lx(safeY);
    const foW = Math.max(safeW - 20, 40);
    const foX = APEX_X - foW / 2;
    const foH = bandH - 4;

    const color = colors[i] ?? '#374151';
    const item = items[N - 1 - i]; // tier 0=top → items[N-1]

    const points = i === 0
      ? `${APEX_X},${APEX_Y} ${rx(y2)},${y2} ${lx(y2)},${y2}`
      : `${lx(y1)},${y1} ${rx(y1)},${y1} ${rx(y2)},${y2} ${lx(y2)},${y2}`;

    // For narrow top tiers: scale down text and hide description if too cramped
    const titleSize = foW > 200 ? 16 : foW > 120 ? 13 : 10;
    const descSize  = titleSize - 3;
    const showDesc  = foW > 160; // only show description when there's enough horizontal room
    const name = item?.title || item?.desc || '';
    const desc = item?.title ? item.desc : '';

    return `<polygon points="${points}" fill="${color}"/>
    ${i < N - 1 ? `<line x1="${lx(y2)}" y1="${y2}" x2="${rx(y2)}" y2="${y2}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>` : ""}
    <foreignObject x="${foX}" y="${midY - foH / 2}" width="${foW}" height="${foH}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 4px;box-sizing:border-box;overflow:hidden">
        <div style="font-size:${titleSize}px;font-weight:800;color:#fff;line-height:1.2;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.03em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(name)}</div>
        ${showDesc && desc ? `<div style="font-size:${descSize}px;color:rgba(255,255,255,0.82);line-height:1.3;font-family:system-ui,sans-serif;margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(desc)}</div>` : ''}
      </div>
    </foreignObject>`;
  });

  return `<div class="slide py-slide">
  <div class="py-header">
    ${label(slide.headerTag)}
    <h2 class="py-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="py-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="py-body">
    <svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="py-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="${clipId}">
          <polygon points="${outlinePoints}"/>
        </clipPath>
      </defs>
      <g clip-path="url(#${clipId})">
        ${tiersSVG.join("\n        ")}
      </g>
    </svg>
    ${slide.subtitle ? `<p class="py-foot">${esc(slide.subtitle)}</p>` : ""}
  </div>
</div>`;
}

// ── CIRCULAR FLOW ──────────────────────────────────────────────────────────────
function renderCircularFlow(slide: Slide): string {
  const rawNodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 5);
  let nodes: FlowNode[] = rawNodes.length >= 3 ? rawNodes
    : (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5).map(b => {
        const p = parseBullet(b);
        return { label: p.title || p.desc, sublabel: p.title ? p.desc.split(" ").slice(0, 4).join(" ") : "" };
      });
  if (nodes.length < 3) nodes = extractFallbackSteps(slide).slice(0, 5).map(s => {
    const p = parseBullet(s);
    return { label: p.title || p.desc, sublabel: "" };
  });
  const n = Math.min(nodes.length, 5);
  if (n < 3) return renderDarkFlow(slide);

  const CX = 370, CY = 290, R_ORBIT = 185, R_NODE = 60;
  const VW = 740, VH = 580;

  // Positions (start at top, clockwise)
  const angles = Array.from({ length: n }, (_, i) => (-Math.PI / 2) + (2 * Math.PI * i) / n);
  const positions = angles.map(a => ({
    x: CX + R_ORBIT * Math.cos(a),
    y: CY + R_ORBIT * Math.sin(a),
  }));

  // Arrow arcs between consecutive nodes (curved, outward from center)
  const arrows = positions.map((from, i) => {
    const to = positions[(i + 1) % n]!;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = midX - CX, dy = midY - CY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const cpX = midX + (dx / dist) * 48;
    const cpY = midY + (dy / dist) * 48;
    const fromAngle = Math.atan2(from.y - cpY, from.x - cpX);
    const toAngle   = Math.atan2(to.y - cpY, to.x - cpX);
    const sx = from.x - R_NODE * Math.cos(fromAngle - Math.PI);
    const sy = from.y - R_NODE * Math.sin(fromAngle - Math.PI);
    const ex = to.x - R_NODE * Math.cos(toAngle - Math.PI);
    const ey = to.y - R_NODE * Math.sin(toAngle - Math.PI);
    return `<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cpX.toFixed(1)} ${cpY.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"
      fill="none" stroke="#D1D5DB" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#cf-arrow)"/>`;
  });

  const circles = positions.map((pos, i) => {
    const nd = nodes[i]!;
    const col = activeAccentPalette[i % activeAccentPalette.length] ?? '#374151';
    const ico = nd.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    const icoPaths = ICONS[ico] ?? ICONS["check-circle"] ?? "";
    const lblLines = svgLines(nd.label.slice(0, 24), 20);
    const labelY1 = pos.y + R_NODE + 22;
    const labelY2 = labelY1 + 17;
    const subY = (lblLines.length > 1 ? labelY2 : labelY1) + 17;
    return `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${R_NODE}" fill="${col}"/>
    <svg x="${(pos.x - 20).toFixed(1)}" y="${(pos.y - 20).toFixed(1)}" width="40" height="40" viewBox="0 0 24 24"
      fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${icoPaths}
    </svg>
    <text x="${pos.x.toFixed(1)}" y="${labelY1.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#111111" font-family="system-ui,sans-serif">${esc(lblLines[0] ?? "")}</text>
    ${lblLines[1] ? `<text x="${pos.x.toFixed(1)}" y="${labelY2.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#111111" font-family="system-ui,sans-serif">${esc(lblLines[1])}</text>` : ""}
    ${nd.sublabel ? `<text x="${pos.x.toFixed(1)}" y="${subY.toFixed(1)}" text-anchor="middle" font-size="11" fill="#6B7280" font-family="system-ui,sans-serif">${esc(nd.sublabel.slice(0, 22))}</text>` : ""}`;
  });

  // Center hub label
  const hubTitle = slide.subtitle ? slide.subtitle.slice(0, 18) : "";
  const hubLines = hubTitle ? svgLines(hubTitle, 14) : [];

  return `<div class="slide cf-slide">
  <div class="cf-header">
    ${label(slide.headerTag)}
    <h2 class="cf-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="cf-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="cf-body">
    <svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="cf-svg">
      <defs>
        <marker id="cf-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#9CA3AF"/>
        </marker>
      </defs>
      ${arrows.join("\n      ")}
      ${circles.join("\n      ")}
      ${hubLines.length > 0 ? `
      <circle cx="${CX}" cy="${CY}" r="52" fill="${activeAccentTint}" stroke="${activeAccent}" stroke-width="2"/>
      <text x="${CX}" y="${CY - (hubLines.length > 1 ? 8 : 0)}" text-anchor="middle" font-size="12" font-weight="700" fill="${activeAccent}" font-family="system-ui,sans-serif">${esc(hubLines[0] ?? "")}</text>
      ${hubLines[1] ? `<text x="${CX}" y="${CY + 17}" text-anchor="middle" font-size="12" font-weight="700" fill="${activeAccent}" font-family="system-ui,sans-serif">${esc(hubLines[1])}</text>` : ""}
      ` : `<circle cx="${CX}" cy="${CY}" r="38" fill="${activeAccentTint}" stroke="${activeAccent}" stroke-width="2" opacity="0.7"/>`}
    </svg>
  </div>
</div>`;
}

// ── VENN OVERLAP ───────────────────────────────────────────────────────────────
function renderVennOverlap(slide: Slide): string {
  const bullets  = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  const fnodes   = (slide.flowNodes   ?? []).filter(Boolean).slice(0, 6);

  const circleItems = bullets.length >= 3
    ? bullets.map(b => { const p = parseBullet(b); const t = !isJunkLabel(p.title) ? p.title : undefined; return { name: t || p.desc, desc: t ? p.desc : "" }; })
    : ["Channel A","Channel B","Channel C","Channel D"].map(n => ({ name: n, desc: "" }));

  const callouts = fnodes.length >= 2
    ? fnodes.map(n => ({ name: n.label, desc: n.sublabel ?? "" }))
    : (slide.metrics ?? []).slice(0, 6).map(m => ({ name: m.label, desc: m.value }));

  const leftCalls  = callouts.slice(0, 3);
  const rightCalls = callouts.slice(3, 6);

  const CX = 550, CY = 270, OFFSET = 85, R = 128;
  const centers = [
    { x: CX,          y: CY - OFFSET },  // top
    { x: CX + OFFSET, y: CY          },  // right
    { x: CX,          y: CY + OFFSET },  // bottom
    { x: CX - OFFSET, y: CY          },  // left
  ];
  const VCOLS = ['#6C63FF', '#2BA3BE', '#1A9E83', '#4891C9'];

  // STEP 1 — circle fills only (no text yet)
  const circleFills = centers.slice(0, Math.min(circleItems.length, 4)).map((c, i) => {
    const col = VCOLS[i % VCOLS.length] ?? '#4891C9';
    return `<circle cx="${c.x}" cy="${c.y}" r="${R}" fill="${col}" fill-opacity="0.78"/>`;
  });

  // STEP 2 — center white circle
  const centerLabel = slide.subtitle ?? "";
  const centerEl = `<circle cx="${CX}" cy="${CY}" r="52" fill="white" stroke="#E5E7EB" stroke-width="1.5"/>
    ${centerLabel ? `<text x="${CX}" y="${CY - 5}" text-anchor="middle" font-size="12" font-weight="800" fill="#111111" font-family="system-ui,sans-serif">${esc(centerLabel.split(" ").slice(0, 2).join(" ").toUpperCase())}</text>
    <text x="${CX}" y="${CY + 12}" text-anchor="middle" font-size="9" fill="#6B7280" font-family="system-ui,sans-serif">${esc(centerLabel.split(" ").slice(2, 5).join(" "))}</text>` : ""}`;

  // STEP 3 — callout lines (drawn before labels so labels sit on top)
  const leftAnchorX = 190, rightAnchorX = 910;
  const leftCallEls = leftCalls.map((c, i) => {
    const ty = 155 + i * 90;
    const lx2 = centers[3]!.x - R + 20;
    const ly2 = CY - 50 + i * 50;
    return `<line x1="${leftAnchorX + 115}" y1="${ty}" x2="${lx2}" y2="${ly2}" stroke="#D1D5DB" stroke-width="1"/>
    <text x="${leftAnchorX + 105}" y="${ty - 7}" text-anchor="end" font-size="12" font-weight="700" fill="#111111" font-family="system-ui,sans-serif">${esc(c.name)}</text>
    ${c.desc ? `<text x="${leftAnchorX + 105}" y="${ty + 10}" text-anchor="end" font-size="10" fill="#6B7280" font-family="system-ui,sans-serif">${esc(c.desc.slice(0, 38))}</text>` : ""}`;
  });

  const rightCallEls = rightCalls.map((c, i) => {
    const ty = 155 + i * 90;
    const rx2 = centers[1]!.x + R - 20;
    const ry2 = CY - 50 + i * 50;
    return `<line x1="${rightAnchorX - 115}" y1="${ty}" x2="${rx2}" y2="${ry2}" stroke="#D1D5DB" stroke-width="1"/>
    <text x="${rightAnchorX - 105}" y="${ty - 7}" text-anchor="start" font-size="12" font-weight="700" fill="#111111" font-family="system-ui,sans-serif">${esc(c.name)}</text>
    ${c.desc ? `<text x="${rightAnchorX - 105}" y="${ty + 10}" text-anchor="start" font-size="10" fill="#6B7280" font-family="system-ui,sans-serif">${esc(c.desc.slice(0, 38))}</text>` : ""}`;
  });

  // STEP 4 — circle labels LAST so they render above every circle fill
  // Each label positioned in the outer petal (away from centre of arrangement)
  const outerDirs = [
    { dx: 0,  dy: -1 },  // top circle → label moves up
    { dx: 1,  dy:  0 },  // right circle → label moves right
    { dx: 0,  dy:  1 },  // bottom circle → label moves down
    { dx: -1, dy:  0 },  // left circle → label moves left
  ];
  const PETAL_DIST = R * 0.55; // distance from circle center toward outer petal

  const circleLabelEls = centers.slice(0, Math.min(circleItems.length, 4)).map((c, i) => {
    const item = circleItems[i]!;
    const dir  = outerDirs[i] ?? { dx: 0, dy: -1 };
    const lx2  = c.x + dir.dx * PETAL_DIST;
    const ly2  = c.y + dir.dy * PETAL_DIST;
    const fw = 160, fh = 48;
    return `<foreignObject x="${lx2 - fw / 2}" y="${ly2 - fh / 2}" width="${fw}" height="${fh}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;font-weight:700;color:white;font-family:system-ui,sans-serif;line-height:1.25;text-shadow:0 1px 4px rgba(0,0,0,0.55);overflow:hidden">${esc(item.name)}</div>
    </foreignObject>`;
  });

  return `<div class="slide ve-slide">
  <div class="ve-header">
    ${label(slide.headerTag)}
    <h2 class="ve-title">${esc(slide.title ?? "")}</h2>
  </div>
  <div class="ve-body">
    <svg viewBox="0 0 1100 540" xmlns="http://www.w3.org/2000/svg" class="ve-svg">
      <!-- Layer 1: all circle fills -->
      ${circleFills.join("\n      ")}
      <!-- Layer 2: center white circle -->
      ${centerEl}
      <!-- Layer 3: callout lines & text (behind circle labels) -->
      ${leftCallEls.join("\n      ")}
      ${rightCallEls.join("\n      ")}
      <!-- Layer 4: circle labels last — always on top -->
      ${circleLabelEls.join("\n      ")}
    </svg>
  </div>
</div>`;
}

// ── PETAL DIAGRAM ─────────────────────────────────────────────────────────────
function renderPetalDiagram(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (bullets.length === 0) bullets = (slide.flowNodes ?? []).map(n => `${n.label}${n.sublabel ? `: ${n.sublabel}` : ""}`).slice(0, 5);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 5);
  const n = Math.max(4, Math.min(bullets.length, 5));
  const items = bullets.slice(0, n).map(b => parseBullet(b));

  const PCOLORS = ['#4A7BA8', '#4A9B8E', '#C27803', '#A83B2A', '#5B4690'];
  const VW = 980, VH = 520;
  const CX = VW / 2, CY = VH / 2 + 10;
  const PETAL_LEN = 155, PETAL_HW = 70;
  const LABEL_DIST = PETAL_LEN + 82;
  const ICON_DIST  = PETAL_LEN * 0.63;
  const ICON_SZ    = 36;
  const ICON_NAMES = [
    "target", "settings", "zap", "users", "bar-chart",
    "shield", "message-circle", "trending-up", "star", "cpu",
  ];

  // Petal bezier: tip at origin pointing in +x direction
  const c1 = PETAL_HW * 0.5, c2 = PETAL_LEN - PETAL_HW * 0.5;
  const petalD = `M 0,0 C ${c1},-${PETAL_HW} ${c2},-${PETAL_HW} ${PETAL_LEN},0 C ${c2},${PETAL_HW} ${c1},${PETAL_HW} 0,0`;

  // Evenly spaced angles starting from top (-90°)
  const degs = Array.from({ length: n }, (_, i) => -90 + i * (360 / n));
  const rads = degs.map(d => (d * Math.PI) / 180);

  // Layer 1 — petal fills
  const petalFills = degs.map((d, i) =>
    `<path d="${petalD}" fill="${PCOLORS[i % PCOLORS.length]}" fill-opacity="0.88"
      transform="translate(${CX},${CY}) rotate(${d})"/>`
  );

  // Layer 2 — center circle
  const subtitle = slide.subtitle ?? "";
  const centerEl = `<circle cx="${CX}" cy="${CY}" r="42" fill="white" stroke="#E5E7EB" stroke-width="2"/>
    ${subtitle ? `<text x="${CX}" y="${CY + 5}" text-anchor="middle" font-size="10" font-weight="800" fill="#374151" font-family="system-ui,sans-serif">${esc(subtitle.slice(0, 14).toUpperCase())}</text>` : ""}`;

  // Layer 3 — icons inside each petal (white, centered along petal axis)
  const petalIcons = rads.map((rad, i) => {
    const ix = CX + ICON_DIST * Math.cos(rad);
    const iy = CY + ICON_DIST * Math.sin(rad);
    const icoName = ICON_NAMES[i % ICON_NAMES.length]!;
    return `<foreignObject x="${ix - ICON_SZ / 2}" y="${iy - ICON_SZ / 2}" width="${ICON_SZ}" height="${ICON_SZ}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${ICON_SZ}px;height:${ICON_SZ}px;display:flex;align-items:center;justify-content:center;color:white;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))">${icon(icoName, ICON_SZ)}</div>
    </foreignObject>`;
  });

  // Layer 4 — labels outside petals (always rendered last → on top)
  const petalLabels = rads.map((rad, i) => {
    const lx = CX + LABEL_DIST * Math.cos(rad);
    const ly = CY + LABEL_DIST * Math.sin(rad);
    const fw = 180, fh = 90;
    const item = items[i];
    const rawTitle = item?.title;
    const name = !isJunkLabel(rawTitle) ? (rawTitle || item?.desc || '') : (item?.desc || '');
    const desc = (!isJunkLabel(rawTitle) && rawTitle) ? item?.desc ?? '' : '';
    const col  = PCOLORS[i % PCOLORS.length]!;
    return `<foreignObject x="${lx - fw / 2}" y="${ly - fh / 2}" width="${fw}" height="${fh}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:system-ui,sans-serif;overflow:hidden">
        <div style="font-size:12px;font-weight:800;color:${col};line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(name)}</div>
        ${desc ? `<div style="font-size:10px;color:#6B7280;line-height:1.35;margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${esc(desc)}</div>` : ''}
      </div>
    </foreignObject>`;
  });

  return `<div class="slide pd-slide">
  <div class="pd-header">
    ${label(slide.headerTag)}
    <h2 class="pd-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="pd-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="pd-body">
    <svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="pd-svg" preserveAspectRatio="xMidYMid meet">
      ${petalFills.join("\n      ")}
      ${centerEl}
      ${petalIcons.join("\n      ")}
      ${petalLabels.join("\n      ")}
    </svg>
  </div>
</div>`;
}

// ─── RENDERER MAP ──────────────────────────────────────────────────────────────
// ── SOCIAL — STATEMENT (canvas-agnostic: works at 16:9, 1:1, 9:16) ──────────────
function renderSocialStatement(slide: Slide): string {
  const accent = activeAccentPalette[0] ?? "#111111";
  const bg = slide.imageUrl
    ? `style="background-image:url('${esc(slide.imageUrl)}')"`
    : `style="background:${accent}"`;
  return `<div class="slide soc-statement" ${bg}>
  ${slide.imageUrl ? `<div class="soc-overlay"></div>` : ""}
  <div class="soc-content">
    ${label(slide.headerTag)}
    <h1 class="soc-statement-title">${esc(slide.title ?? "")}</h1>
    ${slide.subtitle ? `<p class="soc-statement-sub">${esc(slide.subtitle)}</p>` : ""}
  </div>
</div>`;
}

// ── SOCIAL — QUOTE ───────────────────────────────────────────────────────────
function renderSocialQuote(slide: Slide): string {
  const accent = activeAccentPalette[0] ?? "#111111";
  const quote = slide.subtitle || slide.description || "";
  return `<div class="slide soc-quote">
  <div class="soc-quote-mark" style="color:${accent}">&ldquo;</div>
  <p class="soc-quote-text">${esc(quote)}</p>
  <div class="soc-quote-attr">
    ${slide.title ? `<p class="soc-quote-name">${esc(slide.title)}</p>` : ""}
    ${slide.headerTag ? `<p class="soc-quote-role">${esc(slide.headerTag)}</p>` : ""}
  </div>
</div>`;
}

// ── SOCIAL — STAT ────────────────────────────────────────────────────────────
function renderSocialStat(slide: Slide): string {
  const accent = activeAccentPalette[0] ?? "#111111";
  const metric = (slide.metrics ?? [])[0];
  return `<div class="slide soc-stat">
  ${label(slide.headerTag)}
  <div class="soc-stat-value" style="color:${accent}">${esc(metric?.value ?? "")}</div>
  ${metric?.label ? `<p class="soc-stat-label">${esc(metric.label)}</p>` : ""}
  ${slide.description ? `<p class="soc-stat-desc">${esc(slide.description)}</p>` : ""}
</div>`;
}

// ── SOCIAL — LIST CARD (for carousels) ──────────────────────────────────────────
function renderSocialListCard(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 3);
  return `<div class="slide soc-list">
  ${label(slide.headerTag)}
  <h2 class="soc-list-title">${esc(slide.title ?? "")}</h2>
  <div class="soc-list-items">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const accent = activeAccentPalette[i % activeAccentPalette.length] ?? "#111111";
      return `<div class="soc-list-item">
        <span class="soc-list-num" style="background:${accent}">${i + 1}</span>
        <div class="soc-list-text">${!isJunkLabel(p.title) ? `<strong>${esc(p.title!)}</strong> ` : ""}${esc(isJunkLabel(p.title) ? mergeJunk(p.title, p.desc) : p.desc)}</div>
      </div>`;
    }).join("")}
  </div>
</div>`;
}

// ── SOCIAL — CTA (closing card) ──────────────────────────────────────────────
function renderSocialCta(slide: Slide): string {
  const accent = activeAccentPalette[1] ?? activeAccentPalette[0] ?? "#111111";
  const bg = slide.imageUrl
    ? `style="background-image:url('${esc(slide.imageUrl)}')"`
    : `style="background:${accent}"`;
  return `<div class="slide soc-cta" ${bg}>
  ${slide.imageUrl ? `<div class="soc-overlay"></div>` : ""}
  <div class="soc-content">
    <h1 class="soc-cta-title">${esc(slide.title ?? "")}</h1>
    ${slide.subtitle ? `<p class="soc-cta-sub">${esc(slide.subtitle)}</p>` : ""}
    ${slide.headerTag ? `<p class="soc-cta-handle">${esc(slide.headerTag)}</p>` : ""}
  </div>
</div>`;
}

const RENDERERS: Record<LayoutType, (s: Slide) => string> = {
  hero:                    renderHero,
  image_left:              renderImageLeft,
  image_right:             renderImageRight,
  two_column:              renderTwoColumn,
  metrics:                 renderMetrics,
  timeline:                renderTimeline,
  architecture:            renderArchitecture,
  comparison:              renderComparison,
  minimal:                 renderMinimal,
  icon_grid:               renderIconGrid,
  challenge_grid:          renderChallengeGrid,
  flow_kpi:                renderFlowKpi,
  numbered_steps_callout:  renderNumberedStepsCallout,
  process_donut:           renderProcessDonut,
  staggered_phases:        renderStaggeredPhases,
  tech_ecosystem:          renderTechEcosystem,
  text_chart:              renderTextChart,
  text_flow:               renderTextFlow,
  quote_image:             renderQuoteImage,
  dark_steps:              renderDarkSteps,
  dark_comparison:         renderDarkComparison,
  dark_flow:               renderDarkFlow,
  concentric_layers:       renderConcentricLayers,
  big_numbers:             renderBigNumbers,
  split_insight:           renderSplitInsight,
  funnel_stages:           renderFunnelStages,
  arrow_pipeline:          renderArrowPipeline,
  pyramid_tiers:           renderPyramidTiers,
  circular_flow:           renderCircularFlow,
  venn_overlap:            renderVennOverlap,
  petal_diagram:           renderPetalDiagram,
  auto_diagram:            renderAutoDiagram,
  social_statement:        renderSocialStatement,
  social_quote:            renderSocialQuote,
  social_stat:             renderSocialStat,
  social_list_card:        renderSocialListCard,
  social_cta:              renderSocialCta,
};

// ─── CSS ───────────────────────────────────────────────────────────────────────
function getStyles(theme: ThemeTokens, canvasDims: CanvasDims): string {
  return `
@import url('${theme.fontImportUrl}');

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: ${canvasDims.width}in ${canvasDims.height}in; margin: 0; }

html { font-size: 16px; }
body {
  font-family: ${theme.fontBody};
  -webkit-font-smoothing: antialiased;
  background: #1a1a1a;
}
h1, h2, h3 {
  font-family: ${theme.fontHeading};
}

/* ── Slide base ── */
.slide {
  width: ${canvasDims.width}in;
  height: ${canvasDims.height}in;
  overflow: hidden;
  page-break-after: always;
  background: ${theme.background};
  display: flex;
  position: relative;
}

/* ── Watermark badge (opt-in via { watermark: true }) ── */
.slide-watermark {
  position: absolute;
  bottom: 0.5in;
  right: 0.5in;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #ffffff;
  background: rgba(17, 24, 39, 0.72);
  padding: 0.32rem 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  white-space: nowrap;
  pointer-events: none;
}

/* ── Shared tokens ── */
.label {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  color: ${theme.textSecondary};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: ${theme.accentTint};
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  margin-bottom: 0.7rem;
}
.page-title {
  font-size: 2.3rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  line-height: 1.12;
  margin-bottom: 0.5rem;
}
.section-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  line-height: 1.18;
  margin-bottom: 0.6rem;
}
.body-text {
  font-size: 0.85rem;
  color: ${theme.textSecondary};
  line-height: 1.65;
  margin-bottom: 0.4rem;
}
.body-text.italic { font-style: italic; }
.body-text.colored { color: #2563EB; font-weight: 500; }
.rule {
  width: 2rem;
  height: 2px;
  background: ${theme.border};
  margin: 0.7rem 0;
}

/* ── White header (used by many layouts) ── */
.white-header {
  padding: 2rem 2.5rem 1.25rem;
}
.header-rule {
  display: none;
  width: 3rem;
  height: 2px;
  background: ${theme.border};
  margin-top: 0.75rem;
}

/* ══ COVER ══ */
.cover { flex-direction: row; }
.cover-photo {
  width: 50%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.cover-body {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 3.5rem;
}
.cover-inner { max-width: 32rem; }
.cover-title {
  font-size: 2.75rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  line-height: 1.12;
  margin-bottom: 1.1rem;
}
.cover-rule { display: none; }
.cover-subtitle {
  font-size: 1rem;
  font-weight: 400;
  color: ${theme.textSecondary};
  line-height: 1.65;
  margin-bottom: 1.1rem;
}
.cover-meta {
  font-size: 0.78rem;
  color: ${theme.textMuted};
  line-height: 1.5;
}

/* ══ IMAGE LEFT / RIGHT ══ */
.il { flex-direction: row; overflow: hidden; }
.il-photo {
  width: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: #1F2937 center/cover no-repeat;
  background-size: cover;
  background-position: center center;
}
.il-body {
  flex: 1;
  min-width: 0;
  padding: 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
.ir { flex-direction: row; overflow: hidden; }
.ir-body {
  flex: 1;
  min-width: 0;
  padding: 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
.ir-photo {
  width: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: #1F2937 center/cover no-repeat;
  background-size: cover;
  background-position: center center;
}
.feat-rows-clean {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.feat-row-clean {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
}
.frc-icon { flex-shrink: 0; margin-top: 0.1rem; }
.frc-text { flex: 1; }
.frc-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: ${theme.textPrimary};
  margin-bottom: 0.2rem;
  line-height: 1.3;
}
.frc-desc {
  font-size: 0.82rem;
  color: ${theme.textSecondary};
  line-height: 1.55;
}

/* ══ TWO COLUMN ══ */
.two-col { flex-direction: column; }
.feat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: min-content;
  gap: 1rem;
  flex: 1;
  align-content: center;
  padding: 0.5rem 2.5rem 2rem;
}
.feat-card {
  border-radius: ${theme.cardRadius};
  padding: 1.6rem 1.8rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.feat-title {
  font-size: 1rem;
  font-weight: 700;
  color: ${theme.textPrimary};
  margin-bottom: 0.45rem;
}
.feat-desc {
  font-size: 0.84rem;
  color: ${theme.textSecondary};
  line-height: 1.65;
}

/* ══ ARCHITECTURE ══ */
.arch { flex-direction: row; }
.arch-sidebar {
  width: 28%;
  flex-shrink: 0;
  background: #111111;
  border-right: 3px solid #111111;
  padding: 2.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.arch-sidebar .label { color: #6B7280; }
.arch-sidebar-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.25;
  margin-bottom: 0.75rem;
}
.arch-sidebar-desc {
  font-size: 0.78rem;
  color: #9CA3AF;
  line-height: 1.6;
}
.arch-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
}
.feat-rows { display: flex; flex-direction: column; flex: 1; justify-content: center; gap: 0; }
.feat-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.1rem 0;
  border-bottom: 1px solid #E5E7EB;
}
.feat-row:first-child { border-top: 1px solid #E5E7EB; }
.feat-row-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.feat-row-num {
  font-size: 0.72rem;
  font-weight: 700;
  color: #D1D5DB;
  flex-shrink: 0;
  width: 1.5rem;
  padding-top: 0.1rem;
}
.feat-row-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.25rem;
}
.feat-row-desc {
  font-size: 0.82rem;
  color: #4B5563;
  line-height: 1.6;
}

/* ══ COMPARISON (legacy selectors kept for safety) ══ */
.comparison { flex-direction: column; background: #111111; }

/* ══ METRICS ══ */
.metrics-slide { flex-direction: row; }
.metrics-slide.reverse { flex-direction: row-reverse; }
.metrics-photo {
  width: 38%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.metrics-body {
  flex: 1;
  padding: 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 50rem;
  margin: 0 auto;
}
.metrics-list { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.85rem; }
.metric-item { border-bottom: 1px solid #E5E7EB; padding-bottom: 0.75rem; }
.metric-val { font-size: 2.6rem; font-weight: 800; color: #0D0D0D; line-height: 1; }
.metric-lbl { font-size: 0.82rem; font-weight: 700; color: #374151; margin-top: 0.2rem; }
.metric-desc { font-size: 0.76rem; color: #6B7280; margin-top: 0.18rem; line-height: 1.45; }

/* ══ TIMELINE ══ */
.steps { flex-direction: column; }
.steps-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  flex: 1;
}
.step-cell {
  padding: 1.5rem 2.5rem 1.75rem;
  border-bottom: 1px solid #E5E7EB;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.step-cell:nth-child(even) { border-right: none; }
.step-num { font-size: 0.7rem; font-weight: 700; color: #9CA3AF; margin-bottom: 0.5rem; letter-spacing: 0.08em; }
.step-rule { height: 3px; margin-bottom: 0.75rem; width: 2.5rem; border-radius: 2px; }
.step-title { font-size: 1.05rem; font-weight: 800; color: #0D0D0D; margin-bottom: 0.5rem; line-height: 1.25; }
.step-desc { font-size: 0.82rem; color: #4B5563; line-height: 1.7; }

/* ══ MINIMAL ══ */
.minimal { flex-direction: row; }
.minimal.reverse { flex-direction: row-reverse; }
.minimal-photo { width: 38%; flex-shrink: 0; background: #1F2937 center/cover; }
.minimal-body {
  flex: 1;
  padding: 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.minimal-body.no-image {
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2.5rem 5rem;
}
.minimal-title { font-size: 2.8rem; font-weight: 800; color: ${theme.textPrimary}; line-height: 1.12; margin-bottom: 0.75rem; }
.minimal-title-accent { width: 3rem; height: 4px; background: ${theme.accent}; margin: 0 auto 1rem; border-radius: 2px; }
.minimal-sub { font-size: 1rem; color: ${theme.textSecondary}; line-height: 1.6; margin-bottom: 0.75rem; max-width: 44rem; }
.highlight-list {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.highlight-row {
  display: flex;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  border-radius: 6px;
}
.highlight-text { font-size: 0.88rem; color: ${theme.textSecondary}; line-height: 1.6; }
.highlight-text strong { color: ${theme.textPrimary}; font-weight: 700; }

/* ══ ICON GRID ══ */
.icon-grid-slide { flex-direction: column; }
.ig-header {
  display: flex;
  align-items: flex-start;
  gap: 2rem;
}
.ig-header-left { flex: 1; }
.ig-header-right {
  flex: 1;
  display: flex;
  align-items: center;
  padding-top: 1.5rem;
}
.ig-desc {
  font-size: 0.84rem;
  color: ${theme.textSecondary};
  line-height: 1.7;
}
.icon-grid {
  flex: 1;
  display: grid;
  padding: 1rem 2.5rem 1.5rem;
  gap: 2rem;
  align-content: start;
  margin-top: 1rem;
}
.icon-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.ic-icon {
  display: flex;
  align-items: center;
}
.icon-card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: ${theme.textPrimary};
  line-height: 1.35;
}
.icon-card-desc {
  font-size: 0.8rem;
  color: ${theme.textSecondary};
  line-height: 1.6;
  flex: 1;
}

/* ══ CHALLENGE GRID ══ */
/* ── CHALLENGE GRID (stacked icon cards + image) ──────────────────────────── */
.cg-slide {
  display: flex;
  flex-direction: row;
  background: #FFFFFF;
  overflow: hidden;
}
.cg-left {
  flex: 0 0 54%;
  padding: 2.5rem 2.5rem 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.cg-left-full { flex: 1; }
.cg-header { flex-shrink: 0; }
.cg-title {
  font-size: 1.7rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  margin: 0.3rem 0 0;
  line-height: 1.22;
}
.cg-desc {
  font-size: 0.85rem;
  color: ${theme.textSecondary};
  margin: 0.4rem 0 0;
  line-height: 1.55;
}
.cg-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  flex: 1;
  align-content: start;
  margin-top: 0.5rem;
}
.cg-card {
  border-radius: ${theme.cardRadius};
  padding: 1.1rem 1.25rem;
}
.cg-card-text {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.cg-card-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: ${theme.textPrimary};
  margin: 0;
  line-height: 1.3;
}
.cg-card-desc {
  font-size: 0.8rem;
  color: ${theme.textSecondary};
  margin: 0;
  line-height: 1.5;
}
.cg-img-panel {
  flex: 0 0 46%;
  overflow: hidden;
}
.cg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ══ FLOW KPI ══ */
.flow-kpi-slide { flex-direction: row; }
.fk-left {
  flex: 1;
  padding: 2.5rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid #E5E7EB;
}
.fk-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.45rem;
}
.fk-subtitle {
  font-size: 0.85rem;
  color: #2563EB;
  font-weight: 500;
  margin-bottom: 0.5rem;
  line-height: 1.5;
}
.fk-desc {
  font-size: 0.82rem;
  color: #4B5563;
  line-height: 1.65;
  margin-bottom: 1.5rem;
}
.fk-flow-band {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 2rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fk-right {
  width: 38%;
  flex-shrink: 0;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.kpi-heading {
  font-size: 0.72rem;
  font-weight: 700;
  color: #9CA3AF;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 1rem;
}
.kpi-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid #E5E7EB;
}
.kpi-val {
  font-size: 2.2rem;
  font-weight: 800;
  color: #111111;
  line-height: 1;
  flex-shrink: 0;
  min-width: 4.5rem;
}
.kpi-lbl {
  font-size: 0.85rem;
  font-weight: 700;
  color: #374151;
}
.kpi-desc {
  font-size: 0.75rem;
  color: #6B7280;
  margin-top: 0.2rem;
  line-height: 1.45;
}

/* ─ Flow nodes (simple row, used for compact flows) ─ */
.flow-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
}
.flow-row.large .flow-circle { width: 80px; height: 80px; }
.flow-row.large .flow-node-label { font-size: 0.85rem; max-width: 9rem; }
.flow-row.large .flow-node-sub { font-size: 0.72rem; }
.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  max-width: 7rem;
  text-align: center;
}
.flow-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 1.5px solid #D1D5DB;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #374151;
  flex-shrink: 0;
}
.flow-node-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #111111;
  text-align: center;
  line-height: 1.3;
}
.flow-node-sub {
  font-size: 0.62rem;
  color: #6B7280;
  text-align: center;
  line-height: 1.3;
}
.flow-arrow {
  color: #9CA3AF;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* ─ Curved arc flow (SVG) ─ */
.curved-arc-flow {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─ Flow KPI large nodes ─ */
.fk-nodes-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
}
.fk-node-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  max-width: 6.5rem;
  text-align: center;
}
.fk-node-circle {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 1.5px solid #D1D5DB;
  background: #F9FAFB;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  flex-shrink: 0;
}
.fk-node-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #111111;
  text-align: center;
  line-height: 1.3;
}
.fk-node-sub {
  font-size: 0.62rem;
  color: #6B7280;
  text-align: center;
}
.fk-chevron {
  color: #D1D5DB;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* ══ NUMBERED STEPS + CALLOUT (legacy — replaced by dark-steps-slide) ══ */
.steps-callout-slide { flex-direction: column; background: #111111; }

/* ══ PROCESS DONUT ══ */
.process-donut-slide { flex-direction: row; }
.pd-left {
  width: 46%;
  flex-shrink: 0;
  background: ${theme.background};
  padding: 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.pd-title { font-size: 1.5rem; font-weight: 800; color: ${theme.textPrimary}; line-height: 1.25; margin-bottom: 0.5rem; }
.pd-desc { font-size: 0.82rem; color: ${theme.textSecondary}; line-height: 1.55; margin-bottom: 1.25rem; }
.pd-steps { display: flex; flex-direction: column; gap: 0.85rem; }
.pd-step { display: flex; gap: 0.9rem; align-items: flex-start; }
.pd-step-num {
  flex-shrink: 0;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 7px;
  background: ${theme.accentTint};
  color: ${theme.accent};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 800;
}
.pd-step-title { font-size: 0.86rem; font-weight: 700; color: ${theme.textPrimary}; margin-bottom: 0.15rem; }
.pd-step-desc { font-size: 0.78rem; color: ${theme.textSecondary}; line-height: 1.5; }
.pd-right {
  flex: 1;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: ${theme.background};
}
.pd-impact-label {
  font-size: 1rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  margin-bottom: 1.5rem;
}
.pd-donuts {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
}
.donut-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; max-width: 160px; }
.donut-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: ${theme.textPrimary};
  text-align: center;
  max-width: 7rem;
  line-height: 1.35;
}
.donut-desc {
  font-size: 0.7rem;
  color: ${theme.textSecondary};
  text-align: center;
  max-width: 9.5rem;
  line-height: 1.4;
}

/* ══ STAGGERED PHASES ══ */
.staggered-slide { flex-direction: column; }
.staggered-header { padding: 1.5rem 2.5rem 0.85rem; border-bottom: 1px solid #E5E7EB; }
.staggered-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0.85rem;
  padding: 0.85rem 2.5rem 1.25rem;
}
.phase-box {
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  background: #FAFAFA;
  display: flex;
  flex-direction: column;
}
.phase-left { align-self: stretch; }
.phase-right { align-self: stretch; }
.phase-num-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}
.phase-name { font-size: 0.9rem; font-weight: 700; color: #111111; margin-bottom: 0.2rem; }
.phase-period { font-size: 0.75rem; color: #6B7280; font-weight: 600; margin-bottom: 0.7rem; }
.phase-bullets { list-style: none; display: flex; flex-direction: column; gap: 0.3rem; }
.phase-bullets li {
  font-size: 0.78rem;
  color: #4B5563;
  line-height: 1.55;
  padding-left: 0.85rem;
  position: relative;
}
.phase-bullets li::before { content: "·"; position: absolute; left: 0; color: #9CA3AF; font-size: 1rem; }

/* ══ TECH ECOSYSTEM ══ */
.tech-slide { flex-direction: column; }
.tech-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0;
  padding: 0 2rem;
}
.tech-card {
  border: 1px solid #E5E7EB;
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
}
.tech-icon { color: #374151; margin-bottom: 0.75rem; opacity: 0.85; }
.tech-category {
  font-size: 0.72rem;
  font-weight: 700;
  color: #111111;
  letter-spacing: 0.06em;
  margin-bottom: 0.4rem;
}
.tech-items { font-size: 0.78rem; color: #4B5563; line-height: 1.55; }
.tech-disclaimer {
  padding: 0.65rem 2rem;
  border-top: 1px solid #E5E7EB;
  font-size: 0.72rem;
  color: #6B7280;
}

/* ══ TEXT CHART ══ */
.text-chart-slide {
  flex-direction: row;
  padding: 2.5rem 2.5rem;
  align-items: flex-start;
}
.tc-left {
  flex: 1;
  padding-right: 2.5rem;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
.tc-right {
  width: 42%;
  flex-shrink: 0;
  padding-left: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* arrow list (text chart variant) */
.arrow-list-wrap { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.arrow-item { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.82rem; color: #374151; }
.arrow-icon { color: #9CA3AF; flex-shrink: 0; font-size: 0.9rem; margin-top: 0.05rem; }
.arrow-desc { color: #6B7280; }

/* bar chart */
.bar-chart { width: 100%; }
.bar-chart-inner { display: flex; flex-direction: column; width: 100%; }
.bar-y-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: #9CA3AF;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}
.bar-rows { display: flex; flex-direction: column; gap: 0.7rem; }
.bar-row { display: flex; align-items: center; gap: 0.65rem; }
.bar-lbl { font-size: 0.72rem; color: #374151; min-width: 5.5rem; text-align: right; flex-shrink: 0; font-weight: 500; }
.bar-track {
  flex: 1;
  height: 22px;
  background: #F3F4F6;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.4rem;
  min-width: 2.5rem;
  transition: width 0s;
}
.bar-inner-val {
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.bar-x-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 0.4rem;
  padding-left: calc(5.5rem + 0.65rem);
  font-size: 0.65rem;
  color: #9CA3AF;
}
.bar-x-label {
  font-size: 0.65rem;
  color: #9CA3AF;
  text-align: center;
  margin-top: 0.25rem;
  letter-spacing: 0.04em;
}

/* tc right-panel alternatives */
.tc-kpi-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}
.tc-kpi-row {
  padding: 0.9rem 1rem;
  border-left: 3px solid #E5E7EB;
  border-bottom: 1px solid #F3F4F6;
}
.tc-kpi-val {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.25rem;
}
.tc-kpi-lbl {
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
}
.tc-callout-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}
.tc-callout-item {
  padding: 0.75rem 1rem;
  background: #F9FAFB;
  border-radius: 4px;
}
.tc-callout-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.3rem;
}
.tc-callout-desc {
  font-size: 0.78rem;
  color: #4B5563;
  line-height: 1.55;
}

/* ══ TEXT FLOW — split (image left) ══ */
.tf-split { flex-direction: row; }
.tf-split-photo {
  width: 40%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.tf-split-body {
  flex: 1;
  padding: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.tf-flow-compact {
  margin-top: 1.5rem;
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 1.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ══ TEXT FLOW — full-width (no image) ══ */
.text-flow-slide {
  flex-direction: column;
  padding: 2rem 3rem 1.75rem;
  gap: 0;
}
.tf-top {
  flex-shrink: 0;
  margin-bottom: 1.25rem;
}
.tf-subtitle {
  font-size: 0.9rem;
  color: #2563EB;
  margin-top: 0.35rem;
  font-weight: 500;
  line-height: 1.5;
}
.tf-desc {
  font-size: 0.85rem;
  color: #4B5563;
  line-height: 1.75;
}
.tf-flow-band {
  flex: 1;
  min-height: 220px;
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 1.5rem 1rem;
}
.tf-bottom {
  flex-shrink: 0;
  padding-top: 1.1rem;
  border-top: 1px solid #E5E7EB;
  margin-top: 1.1rem;
}
.tf-foot {
  font-size: 0.82rem;
  color: #2563EB;
  line-height: 1.65;
  margin-top: 1.25rem;
  font-style: italic;
}

/* tf list fallback (when no flow nodes) */
.tf-list-fallback {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
  max-width: 42rem;
}
.tf-list-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}
.tf-list-num {
  font-size: 0.68rem;
  font-weight: 800;
  color: #fff;
  min-width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}
.tf-list-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #111111;
  display: block;
  margin-bottom: 0.2rem;
}
.tf-list-desc {
  font-size: 0.8rem;
  color: #4B5563;
  line-height: 1.55;
  margin: 0;
}

/* ══ QUOTE IMAGE ══ */
.quote-image-slide { flex-direction: row; }
.qi-photo {
  width: 50%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.qi-body {
  flex: 1;
  padding: 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.qi-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.2;
  margin-bottom: 1rem;
}
.qi-quote {
  border-left: 3px solid #111111;
  padding-left: 1rem;
  font-size: 0.88rem;
  font-style: italic;
  color: #374151;
  line-height: 1.65;
  margin-bottom: 1rem;
}
.qi-bullets { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; }
.qi-bullet { font-size: 0.8rem; color: #4B5563; }
.qi-tags { display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; }
.qi-tag {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: #F3F4F6;
  color: #374151;
  padding: 0.3rem 0.7rem;
  border: 1px solid #E5E7EB;
}

/* ══ LABEL (shared token for structured slides) ══ */
.dark-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: #9CA3AF;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

/* ══ COMPARISON TABLE (clean white, structured rows) ══ */
.dark-comp-slide {
  background: #ffffff;
  flex-direction: column;
  padding: 2rem 2.5rem 1.25rem;
}
.dark-comp-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.6rem;
}
.dark-comp-desc {
  font-size: 0.84rem;
  color: #4B5563;
  line-height: 1.65;
  margin-bottom: 1rem;
  max-width: 52rem;
}
.dark-comp-table-wrap {
  flex: 1;
  overflow: hidden;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.dark-comp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.dark-comp-table thead tr { background: #F8FAFC; }
.dct-th-feat, .dct-th-bad, .dct-th-good {
  padding: 0.8rem 1rem;
  text-align: left;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  border-bottom: 2px solid #E5E7EB;
}
.dct-th-feat { color: #6B7280; width: 28%; }
.dct-th-bad { color: #B91C1C; width: 36%; background: #FEF2F2; }
.dct-th-good { color: #065F46; width: 36%; background: #F0FDF4; }
.dct-tr { border-bottom: 1px solid #F3F4F6; }
.dct-tr:nth-child(even) { background: #FAFAFA; }
.dct-tr:last-child { border-bottom: none; }
.dct-td-feat {
  padding: 0.6rem 1rem;
  color: #111111;
  font-weight: 600;
}
.dct-td-bad {
  padding: 0.6rem 1rem;
  color: #6B7280;
}
.dct-td-good {
  padding: 0.6rem 1rem;
  color: #374151;
  font-weight: 500;
}

/* two-column fallback */
.dark-comp-cols {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding-top: 0.75rem;
}
.dark-comp-col-hdr {
  font-size: 0.9rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #E5E7EB;
}
.dark-comp-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #4B5563;
  padding: 0.45rem 0;
  border-bottom: 1px solid #F3F4F6;
  line-height: 1.5;
}
.dco-x { color: #DC2626; flex-shrink: 0; font-weight: 700; }
.dco-check { color: #16A34A; flex-shrink: 0; font-weight: 700; }

/* ══ NUMBERED STEPS GRID (clean white, numbered circles at cell corners) ══ */
.dark-steps-slide {
  background: #ffffff;
  flex-direction: column;
}
.ds-header {
  padding: 2.25rem 3rem 1rem;
}
.ds-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  line-height: 1.18;
  margin-bottom: 0.5rem;
}
.ds-desc {
  font-size: 0.85rem;
  color: ${theme.textSecondary};
  line-height: 1.65;
  max-width: 52rem;
}
.ds-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.9rem;
  padding: 0.5rem 3rem 2rem;
}
.ds-cell {
  border: 1px solid ${theme.border};
  border-radius: ${theme.cardRadius};
  padding: 1.1rem 1.4rem;
  display: flex;
  align-items: center;
  gap: 1.1rem;
}
.ds-num-badge {
  flex-shrink: 0;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 800;
}
.ds-cell-body { flex: 1; }
.ds-cell-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: ${theme.textPrimary};
  margin-bottom: 0.2rem;
  line-height: 1.3;
}
.ds-cell-desc {
  font-size: 0.8rem;
  color: ${theme.textSecondary};
  line-height: 1.55;
}
.ds-callout {
  display: flex;
  padding: 1rem 1.4rem;
  margin: 0 3rem 1.5rem;
  border-radius: ${theme.cardRadius};
  flex-shrink: 0;
}
.ds-callout-text { font-size: 0.85rem; font-weight: 600; line-height: 1.55; }

/* ══ LARGE FLOW (accent-colored circles, clean white) ══ */
.dark-flow-slide {
  background: #ffffff;
  flex-direction: column;
  padding: 1.75rem 3rem 1.25rem;
}
.df-header { margin-bottom: 1rem; flex-shrink: 0; }
.df-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.4rem;
}
.df-desc {
  font-size: 0.82rem;
  color: #4B5563;
  line-height: 1.6;
  max-width: 50rem;
}
.df-flow-band {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}
.df-flow-band svg { display: block; width: 100%; height: 100%; }
.df-label-row {
  display: flex;
  flex-shrink: 0;
  padding-top: 0.5rem;
  border-top: 1px solid #F3F4F6;
  margin-top: 0.25rem;
}
.df-label-col {
  flex: 1;
  padding: 0.6rem 0.75rem;
  text-align: center;
}
.df-node-name {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  margin-bottom: 0.2rem;
  line-height: 1.3;
}
.df-node-sub {
  font-size: 0.74rem;
  color: #6B7280;
  line-height: 1.45;
}
.df-foot {
  font-size: 0.78rem;
  color: #2563EB;
  line-height: 1.6;
  margin-top: 0.6rem;
  font-style: italic;
  border-top: 1px solid #E5E7EB;
  padding-top: 0.6rem;
  flex-shrink: 0;
}

/* ── Auto Diagram (engine-driven) ── */
.auto-diagram-slide {
  background: ${theme.background};
  flex-direction: column;
  padding: 1.75rem 3rem 1.25rem;
}
.ad-header { margin-bottom: 0.75rem; flex-shrink: 0; }
.ad-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  line-height: 1.15;
  margin-bottom: 0.4rem;
}
.ad-desc {
  font-size: 0.82rem;
  color: ${theme.textSecondary};
  line-height: 1.6;
  max-width: 52rem;
}
.ad-canvas {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}
.ad-canvas svg { display: block; width: 100%; height: 100%; }
.ad-foot {
  font-size: 0.78rem;
  color: ${theme.accent};
  line-height: 1.6;
  margin-top: 0.5rem;
  font-style: italic;
  border-top: 1px solid ${theme.border};
  padding-top: 0.55rem;
  flex-shrink: 0;
}

/* ── Concentric Layers ── */
.conc-slide {
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 0.85in 0.75in 0.6in;
}
.conc-header { margin-bottom: 0.5rem; }
.conc-title {
  font-size: 1.65rem;
  font-weight: 800;
  color: #111111;
  line-height: 1.25;
  margin-bottom: 0.35rem;
}
.conc-desc {
  font-size: 0.875rem;
  color: #6B7280;
  max-width: 58ch;
  line-height: 1.55;
}
.conc-diagram-wrap {
  flex: 1;
  min-height: 0;
}
.conc-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
  margin-top: 0.5rem;
}
.conc-card {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
}
.conc-card-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.2rem;
}
.conc-card-desc {
  font-size: 0.78rem;
  color: #6B7280;
  line-height: 1.45;
}
.conc-card-desc--solo {
  font-size: 0.84rem;
  color: #111111;
  font-weight: 500;
}

/* ── BIG NUMBERS ─────────────────────────────────────────────────────────── */
.bn-slide {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  background: #FFFFFF;
  padding: 2rem 4rem;
  gap: 1rem;
}
.bn-header { width: 100%; text-align: center; }
.bn-title {
  font-size: 1.9rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  margin: 0.3rem 0 0;
  line-height: 1.25;
}
.bn-desc {
  font-size: 0.9rem;
  color: ${theme.textSecondary};
  margin: 0.5rem auto 0;
  max-width: 680px;
}
.bn-stats {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  width: 100%;
  max-width: 980px;
}
.bn-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0 2rem;
}
.bn-value {
  font-size: 4rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: ${theme.textPrimary};
}
.bn-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: ${theme.textPrimary};
}
.bn-stat-desc {
  font-size: 0.78rem;
  color: ${theme.textSecondary};
  text-align: center;
  line-height: 1.5;
  max-width: 200px;
}
.bn-divider {
  width: 1px;
  height: 100px;
  background: ${theme.border};
  flex-shrink: 0;
}
.bn-foot {
  font-size: 0.82rem;
  color: ${theme.textMuted};
  margin: 0;
  font-style: italic;
}
.callout-row {
  display: flex;
  gap: 1rem;
  width: 100%;
  max-width: 980px;
  margin-top: 1rem;
}
.callout-box {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  border-radius: ${theme.cardRadius};
  padding: 0.9rem 1.1rem;
  text-align: left;
}
.callout-icon { flex-shrink: 0; margin-top: 0.1rem; }
.callout-text { font-size: 0.8rem; line-height: 1.5; }

/* ── SPLIT INSIGHT ───────────────────────────────────────────────────────── */
.si-slide {
  display: flex;
  flex-direction: column;
  background: ${theme.background};
  padding: 2.5rem 3rem 2rem;
  gap: 1.25rem;
}
.si-top { flex-shrink: 0; }
.si-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: ${theme.textPrimary};
  margin: 0.2rem 0 0;
  line-height: 1.25;
}
.si-body {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 1rem;
  min-height: 0;
}
.si-left {
  flex: 1;
  background: #FEF2F2;
  border-radius: ${theme.cardRadius};
  padding: 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.si-right {
  flex: 1;
  background: ${theme.accentTint};
  border-radius: ${theme.cardRadius};
  padding: 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.si-divider { display: none; }
.si-panel-head {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 0.5rem;
}
.si-left-head { color: #B91C1C; }
.si-right-head { color: ${theme.accent}; }
.si-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.si-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.82rem;
  line-height: 1.4;
}
.si-bullet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.35rem;
}
.si-dot-left { background: #DC2626; }
.si-dot-right { background: ${theme.accent}; }
.si-item-title {
  font-weight: 700;
  color: inherit;
}
.si-left .si-item-title { color: #7F1D1D; }
.si-right .si-item-title { color: ${theme.textPrimary}; }
.si-item-desc {
  color: #B45454;
  font-size: 0.78rem;
}
.si-right .si-item-desc { color: ${theme.textSecondary}; }

/* ── FUNNEL STAGES ────────────────────────────────────────────────────────── */
.fn-slide { flex-direction: row; background: #fff; overflow: hidden; }
.fn-left {
  flex: 0 0 42%;
  padding: 2.25rem 2rem 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
}
.fn-title { font-size: 1.55rem; font-weight: 700; color: #111111; margin: 0.3rem 0 0; line-height: 1.25; }
.fn-desc  { font-size: 0.82rem; color: #6B7280; margin: 0; line-height: 1.5; }
.fn-legend { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 0.5rem; }
.fn-leg-row { display: flex; align-items: flex-start; gap: 0.65rem; }
.fn-dot { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; margin-top: 3px; }
.fn-leg-text { display: flex; flex-direction: column; gap: 0.05rem; }
.fn-leg-name { font-size: 0.82rem; font-weight: 600; color: #111111; }
.fn-leg-val  { font-size: 0.75rem; color: #6B7280; }
.fn-foot { font-size: 0.75rem; color: #9CA3AF; font-style: italic; margin: 0; margin-top: 0.5rem; }
.fn-right {
  flex: 0 0 58%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 2.5rem 2rem 1rem;
}
.fn-svg { width: 100%; height: auto; }

/* ── ARROW PIPELINE ──────────────────────────────────────────────────────── */
.ap-slide { flex-direction: column; background: #fff; padding: 2rem 2.5rem 1.5rem; gap: 1.25rem; }
.ap-header { flex-shrink: 0; }
.ap-title { font-size: 1.6rem; font-weight: 700; color: #111111; margin: 0.3rem 0 0; line-height: 1.25; }
.ap-desc  { font-size: 0.82rem; color: #6B7280; margin: 0.3rem 0 0; }
.ap-arrows {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 0;
  min-height: 0;
}
.ap-arrow {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 1rem 1rem 2.75rem;
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%, 22px 50%);
  margin-left: -22px;
  gap: 0.3rem;
}
.ap-first {
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%);
  margin-left: 0;
  padding-left: 1.5rem;
}
.ap-num { font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.55); letter-spacing: 0.1em; }
.ap-step-title { font-size: 0.85rem; font-weight: 700; color: #fff; margin: 0; line-height: 1.3; }
.ap-step-desc  { font-size: 0.72rem; color: rgba(255,255,255,0.75); margin: 0; line-height: 1.35; }
.ap-callout {
  font-size: 0.82rem;
  color: #4B5563;
  padding: 0.6rem 1rem;
  background: #F3F4F6;
  border-radius: 6px;
  border-left: 3px solid #111111;
  flex-shrink: 0;
}

/* ── PYRAMID TIERS ───────────────────────────────────────────────────────── */
.py-slide { flex-direction: column; background: #fff; padding: 1.5rem 3rem 0.75rem; gap: 0.5rem; }
.py-header { flex-shrink: 0; }
.py-title { font-size: 1.6rem; font-weight: 700; color: #111111; margin: 0.25rem 0 0; line-height: 1.25; }
.py-desc  { font-size: 0.8rem; color: #6B7280; margin: 0.2rem 0 0; line-height: 1.45; }
.py-body  { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.py-svg   { width: 100%; max-width: 620px; height: auto; }
.py-foot  { font-size: 0.74rem; color: #9CA3AF; font-style: italic; margin: 0.4rem 0 0; text-align: center; }

/* ── CIRCULAR FLOW ───────────────────────────────────────────────────────── */
.cf-slide { flex-direction: column; background: #fff; padding: 1.5rem 2.5rem 1rem; gap: 0.25rem; }
.cf-header { flex-shrink: 0; }
.cf-title { font-size: 1.6rem; font-weight: 700; color: #111111; margin: 0.3rem 0 0; line-height: 1.25; }
.cf-desc  { font-size: 0.82rem; color: #6B7280; margin: 0.25rem 0 0; }
.cf-body  { flex: 1; display: flex; align-items: stretch; justify-content: center; min-height: 0; overflow: hidden; }
.cf-svg   { width: 100%; height: 100%; }

/* ── VENN OVERLAP ────────────────────────────────────────────────────────── */
.ve-slide { flex-direction: column; background: #fff; padding: 1.5rem 1.5rem 0.5rem; gap: 0.25rem; }
.ve-header { flex-shrink: 0; }
.ve-title { font-size: 1.55rem; font-weight: 700; color: #111111; margin: 0.2rem 0 0; line-height: 1.25; }
.ve-body  { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.ve-svg   { width: 100%; height: auto; max-height: 460px; }

/* ── PETAL DIAGRAM ───────────────────────────────────────────────────────── */
.pd-slide { flex-direction: column; background: #fff; padding: 1.5rem 2rem 0.5rem; gap: 0.25rem; }
.pd-header { flex-shrink: 0; }
.pd-title { font-size: 1.55rem; font-weight: 700; color: #111111; margin: 0.2rem 0 0; line-height: 1.25; }
.pd-desc  { font-size: 0.8rem; color: #6B7280; margin: 0.2rem 0 0; }
.pd-body  { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.pd-svg   { width: 100%; height: auto; max-height: 450px; }

/* ══ SOCIAL — canvas-agnostic layouts (widescreen / square / vertical) ══ */
.soc-statement, .soc-cta {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8% 10%;
  position: relative;
  background-size: cover;
  background-position: center;
}
.soc-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.6));
}
.soc-content { position: relative; z-index: 1; max-width: 90%; }
.soc-statement .label, .soc-cta .label { color: rgba(255,255,255,0.75); }
.soc-statement-title {
  font-size: 2.6rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.15;
}
.soc-statement-sub {
  font-size: 1.05rem;
  color: rgba(255,255,255,0.88);
  margin-top: 1rem;
  line-height: 1.5;
}
.soc-cta-title { font-size: 2.3rem; font-weight: 800; color: #fff; line-height: 1.18; }
.soc-cta-sub { font-size: 1.05rem; color: rgba(255,255,255,0.9); margin-top: 0.9rem; line-height: 1.5; }
.soc-cta-handle {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.75);
  margin-top: 1.5rem;
  text-transform: uppercase;
}

.soc-quote {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8% 12%;
}
.soc-quote-mark { font-size: 4rem; font-weight: 800; line-height: 1; margin-bottom: 0.5rem; }
.soc-quote-text { font-size: 1.5rem; font-weight: 600; color: ${theme.textPrimary}; line-height: 1.4; max-width: 90%; }
.soc-quote-attr { margin-top: 1.5rem; }
.soc-quote-name { font-size: 0.95rem; font-weight: 700; color: ${theme.textPrimary}; }
.soc-quote-role { font-size: 0.8rem; color: ${theme.textMuted}; margin-top: 0.2rem; }

.soc-stat {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8% 10%;
}
.soc-stat-value { font-size: 5rem; font-weight: 800; line-height: 1; }
.soc-stat-label { font-size: 1.1rem; font-weight: 600; color: ${theme.textPrimary}; margin-top: 0.75rem; }
.soc-stat-desc { font-size: 0.9rem; color: ${theme.textSecondary}; margin-top: 0.75rem; max-width: 80%; line-height: 1.5; }

.soc-list { flex-direction: column; justify-content: center; padding: 7% 9%; }
.soc-list-title { font-size: 1.9rem; font-weight: 800; color: ${theme.textPrimary}; line-height: 1.2; margin-bottom: 1.25rem; }
.soc-list-items { display: flex; flex-direction: column; gap: 1rem; }
.soc-list-item { display: flex; align-items: flex-start; gap: 0.85rem; }
.soc-list-num {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 0.95rem;
}
.soc-list-text { font-size: 1rem; color: ${theme.textSecondary}; line-height: 1.5; padding-top: 0.15rem; }
.soc-list-text strong { color: ${theme.textPrimary}; }
`;
}

// ─── HTML GENERATOR ────────────────────────────────────────────────────────────
// Sets the module-level accent globals from a theme + accent override. Both the
// per-slide renderer and the shared stylesheet read these, so callers must run
// this before rendering. Returns the resolved theme tokens.
function applyThemeGlobals(
  themeName: ThemeName,
  accentOverride: AccentOverride | null
): ThemeTokens {
  const theme = applyAccentOverride(THEMES[themeName], accentOverride);
  activeAccentPalette = theme.accentPalette;
  activeAccent = theme.accent;
  activeAccentTint = theme.accentTint;
  activeTheme = theme;
  return theme;
}

// Watermark badge (text from .env WATERMARK_TEXT) — injected just before a
// slide's closing tag so it sits at the bottom of the page.
function watermarkBadge(watermark: boolean): string {
  const watermarkText = process.env.WATERMARK_TEXT ?? "Made with slydehq.com";
  return watermark ? `<div class="slide-watermark">${esc(watermarkText)}</div>` : "";
}

// Render ONE slide to a self-contained HTML fragment. The streaming pipeline
// emits these individually; buildHTML composes them for the full-deck PDF.
// Rendering is synchronous, so the shared accent globals set here are safe to
// reuse across parallel callers (no await between setting and using them).
export function renderSlideHTML(
  slide: Slide,
  themeName: ThemeName = "corporate",
  _canvas: CanvasFormat = "widescreen_16_9",
  accentOverride: AccentOverride | null = null,
  watermark = false
): string {
  applyThemeGlobals(themeName, accentOverride);
  const badge = watermarkBadge(watermark);
  const html = RENDERERS[resolveLayout(slide)](slide);
  // Insert the badge inside the slide's root div (its last </div>).
  return badge ? html.replace(/<\/div>\s*$/, `${badge}</div>`) : html;
}

// The shared stylesheet for a deck — emitted once over SSE so every streamed
// slide fragment renders with identical styling.
export function getDeckStyles(
  themeName: ThemeName = "corporate",
  canvas: CanvasFormat = "widescreen_16_9",
  accentOverride: AccentOverride | null = null
): string {
  const theme = applyThemeGlobals(themeName, accentOverride);
  return getStyles(theme, CANVAS_DIMS[canvas]);
}

function buildHTML(
  deckTitle: string,
  slides: Slide[],
  themeName: ThemeName = "corporate",
  canvas: CanvasFormat = "widescreen_16_9",
  accentOverride: AccentOverride | null = null,
  watermark = false
): string {
  const theme = applyThemeGlobals(themeName, accentOverride);
  const canvasDims = CANVAS_DIMS[canvas];
  const sorted = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);
  const slideHTMLs = sorted.map(s =>
    renderSlideHTML(s, themeName, canvas, accentOverride, watermark)
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(deckTitle)}</title>
<style>${getStyles(theme, canvasDims)}</style>
</head>
<body>
${slideHTMLs.join("\n")}
</body>
</html>`;
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────────
export async function generatePDF(
  deckTitle: string,
  slides: Slide[],
  storyTheme = "",
  themeName: ThemeName = "corporate",
  canvas: CanvasFormat = "widescreen_16_9",
  accentOverride: AccentOverride | null = null,
  watermark = false
): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const html = buildHTML(deckTitle, slides, themeName, canvas, accentOverride, watermark);
  const canvasDims = CANVAS_DIMS[canvas];
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const fileName = `${Date.now()}.pdf`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    await page.pdf({
      path: filePath,
      width: `${canvasDims.width}in`,
      height: `${canvasDims.height}in`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return filePath;
  } finally {
    await browser.close();
  }
}

// ─── PHOTO LAYOUT CHECK (used by index.ts to skip image fetch for non-photo layouts) ─
export function needsPhoto(slide: Slide): boolean {
  return PHOTO_LAYOUTS.has(resolveLayout(slide));
}
