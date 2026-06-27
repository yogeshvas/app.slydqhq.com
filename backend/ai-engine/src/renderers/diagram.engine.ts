// ─── AUTO-DIAGRAM ENGINE ─────────────────────────────────────────────────────
// A dependency-free, fully deterministic diagram layout engine.
//
// The AI never produces coordinates. It produces only a SEMANTIC graph — nodes,
// typed edges, and a diagramType — and this engine computes ALL geometry and
// emits a self-contained <svg> string. That keeps the AI free to express any
// branching/hierarchical/cyclic structure while guaranteeing non-overlapping,
// on-canvas output (LLMs are unreliable at spatial layout).
//
// Supported diagram types:
//   tree       → hierarchical fan-out (root → children → grandchildren), top-down
//   flow       → left→right sequence / branching pipeline (a layered DAG)
//   cycle      → nodes arranged on a ring with directional arrows
//   comparison → two paired columns (A vs B) with a central spine
//
// Rendering is synchronous and returns a string, matching every other renderer
// in pdf.renderer.ts — no browser, no client JS, no network at render time.

export type DiagramType = "tree" | "flow" | "cycle" | "comparison";

export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  icon?: string; // optional Lucide icon name (resolved by the caller)
  /** Only used by the "comparison" type to assign a node to a side. */
  group?: "left" | "right";
  /** Comparison only: the dimension this row compares (e.g. "Scalability"). */
  rowLabel?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramSpec {
  diagramType: DiagramType;
  /** Optional center/root caption — used by "comparison" as the spine label. */
  title?: string;
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  /** Override the default flow direction for tree/flow. */
  direction?: "horizontal" | "vertical";
}

export interface DiagramTheme {
  palette: string[];
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  border: string;
  accent: string;
  /** Returns the inner SVG path markup for a Lucide icon name (no <svg> wrapper). */
  resolveIcon?: (name?: string, index?: number) => string;
}

// Canvas the engine lays out in. Scaled to 100% width by the host slide.
const W = 1280;
const H = 560;
const PAD = 28;

function esc(s: any): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Validate + normalize an AI-supplied spec. Returns null when it can't yield a
// sensible diagram, so the host renderer can fall back to a template layout.
export function normalizeSpec(raw: any): DiagramSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const type: DiagramType = ["tree", "flow", "cycle", "comparison"].includes(raw.diagramType)
    ? raw.diagramType
    : "flow";

  const nodes: DiagramNode[] = Array.isArray(raw.nodes)
    ? raw.nodes
        .filter((n: any) => n && (n.id != null) && String(n.label ?? "").trim())
        .map((n: any) => ({
          id: String(n.id),
          label: String(n.label).trim(),
          sublabel: n.sublabel ? String(n.sublabel).trim() : undefined,
          icon: n.icon ? String(n.icon).trim() : undefined,
          group: n.group === "left" || n.group === "right" ? n.group : undefined,
          rowLabel: n.rowLabel ? String(n.rowLabel).trim() : undefined,
        }))
        // Hard cap: comparison matrices can run to 6 rows (12 nodes); other
        // types stay legible up to ~10. 14 is the absolute ceiling.
        .slice(0, 14)
    : [];

  if (nodes.length < 2) return null;

  const ids = new Set(nodes.map(n => n.id));
  const edges: DiagramEdge[] = Array.isArray(raw.edges)
    ? raw.edges
        .filter((e: any) => e && ids.has(String(e.from)) && ids.has(String(e.to)) && e.from !== e.to)
        .map((e: any) => ({ from: String(e.from), to: String(e.to), label: e.label ? String(e.label).trim() : undefined }))
    : [];

  return {
    diagramType: type,
    title: raw.title ? String(raw.title).trim() : undefined,
    nodes,
    edges,
    direction: raw.direction === "horizontal" || raw.direction === "vertical" ? raw.direction : undefined,
  };
}

// ─── PUBLIC ENTRY ────────────────────────────────────────────────────────────
export function renderDiagramSVG(spec: DiagramSpec, theme: DiagramTheme): string {
  switch (spec.diagramType) {
    case "tree":       return layeredSVG(spec, theme, spec.direction ?? "vertical");
    case "flow":       return layeredSVG(spec, theme, spec.direction ?? "horizontal");
    case "cycle":      return cycleSVG(spec, theme);
    case "comparison": return comparisonSVG(spec, theme);
    default:           return layeredSVG(spec, theme, "horizontal");
  }
}

// ─── SHARED SVG PRIMITIVES ───────────────────────────────────────────────────
function nodeBox(
  n: DiagramNode,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
  theme: DiagramTheme,
): string {
  const icon = theme.resolveIcon?.(n.icon);
  const iconChip = icon
    ? `<div style="flex:0 0 auto;width:28px;height:28px;border-radius:8px;background:${accent};display:flex;align-items:center;justify-content:center;">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
       </div>`
    : "";
  const sub = n.sublabel
    ? `<div style="font-size:11px;line-height:1.25;color:${theme.textSecondary};margin-top:2px;">${esc(n.sublabel)}</div>`
    : "";
  return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:${w}px;height:${h}px;display:flex;align-items:center;gap:10px;padding:0 14px;background:${theme.cardBg};border:1px solid ${theme.border};border-left:4px solid ${accent};border-radius:12px;overflow:hidden;">
      ${iconChip}
      <div style="min-width:0;">
        <div style="font-size:14px;font-weight:700;line-height:1.2;color:${theme.textPrimary};">${esc(n.label)}</div>
        ${sub}
      </div>
    </div>
  </foreignObject>`;
}

function edgeLabel(x: number, y: number, text: string, theme: DiagramTheme): string {
  const w = Math.max(text.length * 6.4 + 12, 22);
  return `<g>
    <rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="18" rx="5" fill="${theme.cardBg}" stroke="${theme.border}" stroke-width="1"/>
    <text x="${x}" y="${y + 3}" text-anchor="middle" font-size="10" font-weight="600" fill="${theme.textSecondary}" font-family="Inter,sans-serif">${esc(text)}</text>
  </g>`;
}

interface Box { x: number; y: number; w: number; h: number; }

// Tighten the viewBox to the actual content bounds (+ margin) so the diagram
// scales up to fill its band instead of floating in a fixed canvas. This is
// what removes the dead vertical/horizontal whitespace on sparse graphs.
function boundsOf(boxes: Box[], margin = 36): { x: number; y: number; w: number; h: number } {
  if (boxes.length === 0) return { x: 0, y: 0, w: W, h: H };
  const minX = Math.min(...boxes.map(b => b.x));
  const minY = Math.min(...boxes.map(b => b.y));
  const maxX = Math.max(...boxes.map(b => b.x + b.w));
  const maxY = Math.max(...boxes.map(b => b.y + b.h));
  return { x: minX - margin, y: minY - margin, w: maxX - minX + margin * 2, h: maxY - minY + margin * 2 };
}

function svgFrame(inner: string, accent: string, vb?: { x: number; y: number; w: number; h: number }): string {
  const v = vb ?? { x: 0, y: 0, w: W, h: H };
  return `<svg viewBox="${v.x} ${v.y} ${v.w} ${v.h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;">
    <defs>
      <marker id="dg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </marker>
    </defs>
    ${inner}
  </svg>`;
}

// ─── LAYERED LAYOUT (tree + flow) ────────────────────────────────────────────
// Longest-path layering from roots, even spacing within each layer. For the
// small graphs this serves (≤10 nodes) even spacing reads cleanly and can never
// overlap, since layers are separated on the primary axis and nodes are evenly
// distributed on the cross axis.
function layeredSVG(spec: DiagramSpec, theme: DiagramTheme, dir: "horizontal" | "vertical"): string {
  const { nodes, edges = [] } = spec;
  const byId = new Map(nodes.map(n => [n.id, n]));

  const indeg = new Map<string, number>(nodes.map(n => [n.id, 0]));
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);

  // Longest-path layer assignment (relaxation, capped at node count → DAG-safe).
  const layer = new Map<string, number>(nodes.map(n => [n.id, 0]));
  for (let iter = 0; iter < nodes.length; iter++) {
    let changed = false;
    for (const e of edges) {
      const want = (layer.get(e.from) ?? 0) + 1;
      if (want > (layer.get(e.to) ?? 0)) {
        layer.set(e.to, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Nodes with no incoming edge AND no outgoing placement stay at layer 0;
  // orphan nodes (no edges at all) also sit on layer 0 in input order.

  const maxLayer = Math.max(0, ...Array.from(layer.values()));
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of nodes) layers[layer.get(n.id) ?? 0]!.push(n.id);

  const maxK = Math.max(...layers.map(l => l.length));
  const L = layers.length;

  // Box sizing — derived from the busiest axis so the whole graph fits.
  const pos = new Map<string, { x: number; y: number; w: number; h: number }>();

  if (dir === "vertical") {
    // Layers stack top→bottom; nodes spread across the width.
    const boxW = clamp((W - 2 * PAD) / (maxK + 0.4) - 18, 120, 230);
    const boxH = clamp((H - 2 * PAD) / L - 22, 46, 78);
    const gapY = L > 1 ? (H - 2 * PAD - boxH) / (L - 1) : 0;
    layers.forEach((ids, li) => {
      const yc = PAD + boxH / 2 + li * gapY;
      const k = ids.length;
      ids.forEach((id, j) => {
        const xc = (W * (j + 1)) / (k + 1);
        pos.set(id, { x: xc - boxW / 2, y: yc - boxH / 2, w: boxW, h: boxH });
      });
    });
  } else {
    // Layers march left→right; nodes spread down the height.
    const boxW = clamp((W - 2 * PAD) / L - 28, 140, 250);
    const boxH = clamp((H - 2 * PAD) / (maxK + 0.4) - 14, 46, 84);
    const gapX = L > 1 ? (W - 2 * PAD - boxW) / (L - 1) : 0;
    layers.forEach((ids, li) => {
      const xc = PAD + boxW / 2 + li * gapX;
      const k = ids.length;
      ids.forEach((id, j) => {
        const yc = (H * (j + 1)) / (k + 1);
        pos.set(id, { x: xc - boxW / 2, y: yc - boxH / 2, w: boxW, h: boxH });
      });
    });
  }

  // Edges — drawn under the boxes, from parent face to child face.
  const edgeSVG = edges.map(e => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) return "";
    let x1: number, y1: number, x2: number, y2: number, c1: string, c2: string;
    if (dir === "vertical") {
      x1 = a.x + a.w / 2; y1 = a.y + a.h;
      x2 = b.x + b.w / 2; y2 = b.y;
      const mid = (y1 + y2) / 2;
      c1 = `${x1} ${mid}`; c2 = `${x2} ${mid}`;
    } else {
      x1 = a.x + a.w; y1 = a.y + a.h / 2;
      x2 = b.x; y2 = b.y + b.h / 2;
      const mid = (x1 + x2) / 2;
      c1 = `${mid} ${y1}`; c2 = `${mid} ${y2}`;
    }
    const accent = theme.palette[(layer.get(e.from) ?? 0) % theme.palette.length] ?? theme.accent;
    const path = `<path d="M ${x1} ${y1} C ${c1}, ${c2}, ${x2} ${y2}" fill="none" stroke="${accent}" stroke-width="2" marker-end="url(#dg-arrow)"/>`;
    // Only label edges with room — a short adjacent-layer edge would collide
    // the label with the node boxes at either end.
    const span = dir === "vertical" ? Math.abs(y2 - y1) : Math.abs(x2 - x1);
    const need = dir === "vertical" ? 26 : (e.label ?? "").length * 6.4 + 28;
    const lbl = e.label && span > need ? edgeLabel((x1 + x2) / 2, (y1 + y2) / 2, e.label, theme) : "";
    return path + lbl;
  }).join("");

  const nodeSVG = nodes.map(n => {
    const p = pos.get(n.id)!;
    const accent = theme.palette[(layer.get(n.id) ?? 0) % theme.palette.length] ?? theme.accent;
    return nodeBox(n, p.x, p.y, p.w, p.h, accent, theme);
  }).join("");

  return svgFrame(edgeSVG + nodeSVG, theme.accent, boundsOf([...pos.values()]));
}

// ─── CYCLE LAYOUT ────────────────────────────────────────────────────────────
function cycleSVG(spec: DiagramSpec, theme: DiagramTheme): string {
  const nodes = spec.nodes.slice(0, 8);
  const n = nodes.length;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 130;
  const boxW = 190, boxH = 64;

  const pts = nodes.map((_, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n; // start at top, clockwise
    return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ang };
  });

  // Curved arrows between consecutive nodes around the ring.
  const arrows = pts.map((p, i) => {
    const q = pts[(i + 1) % n]!;
    const accent = theme.palette[i % theme.palette.length] ?? theme.accent;
    // Pull the control point outward from center for a gentle arc.
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const ox = mx + (mx - cx) * 0.18, oy = my + (my - cy) * 0.18;
    return `<path d="M ${p.x} ${p.y} Q ${ox} ${oy} ${q.x} ${q.y}" fill="none" stroke="${accent}" stroke-width="2" marker-end="url(#dg-arrow)" opacity="0.85"/>`;
  }).join("");

  const boxes = nodes.map((nd, i) => {
    const p = pts[i]!;
    const accent = theme.palette[i % theme.palette.length] ?? theme.accent;
    return nodeBox(nd, p.x - boxW / 2, p.y - boxH / 2, boxW, boxH, accent, theme);
  }).join("");

  const center = spec.title
    ? `<foreignObject x="${cx - 90}" y="${cy - 34}" width="180" height="68">
         <div xmlns="http://www.w3.org/1999/xhtml" style="width:180px;height:68px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:14px;font-weight:800;color:${theme.textPrimary};">${esc(spec.title)}</div>
       </foreignObject>`
    : "";

  const ringBoxes: Box[] = pts.map(p => ({ x: p.x - boxW / 2, y: p.y - boxH / 2, w: boxW, h: boxH }));
  return svgFrame(arrows + boxes + center, theme.accent, boundsOf(ringBoxes, 28));
}

// ─── COMPARISON LAYOUT ───────────────────────────────────────────────────────
// A side-by-side comparison MATRIX. Each row pairs a left node with a right node;
// the left node may carry a `rowLabel` (the dimension, e.g. "Scalability") shown
// as a pill, and an `icon` shown in a central spine circle between the two sides.
// Layout: [ dimension pill ] ┄ [ left value ] ─(icon)─ [ right value ].
function comparisonSVG(spec: DiagramSpec, theme: DiagramTheme): string {
  const grouped = spec.nodes.some(n => n.group);
  let left: DiagramNode[], right: DiagramNode[];
  if (grouped) {
    left = spec.nodes.filter(n => n.group === "left");
    right = spec.nodes.filter(n => n.group === "right");
  } else {
    const half = Math.ceil(spec.nodes.length / 2);
    left = spec.nodes.slice(0, half);
    right = spec.nodes.slice(half);
  }
  const rows = Math.max(left.length, right.length);
  if (rows === 0) return svgFrame("", theme.accent);

  const hasDim = [...left, ...right].some(n => n?.rowLabel);
  const padL = 6;
  const dimW = hasDim ? 150 : 0;
  const gap = 20;
  const iconR = 32;
  const spineX = (W + (hasDim ? dimW + gap : 0)) / 2 + 40;

  const leftColLeft = hasDim ? dimW + gap : padL;
  const leftColRight = spineX - iconR - gap;
  const leftColW = leftColRight - leftColLeft;
  const rightColLeft = spineX + iconR + gap;
  const rightColW = W - padL - rightColLeft;

  const boxH = clamp((H - 2 * PAD) / rows - 14, 50, 92);
  const gapY = rows > 1 ? (H - 2 * PAD - boxH) / (rows - 1) : 0;
  const leftAccent = theme.palette[0] ?? theme.accent;
  const rightAccent = theme.palette[1] ?? theme.palette[0] ?? theme.accent;

  // A clean value card: title (bold) + optional detail, accent left border.
  const card = (n: DiagramNode, x: number, w: number, yc: number, accent: string) => {
    const sub = n.sublabel
      ? `<div style="font-size:11.5px;line-height:1.3;color:${theme.textSecondary};margin-top:3px;">${esc(n.sublabel)}</div>`
      : "";
    return `<foreignObject x="${x}" y="${yc - boxH / 2}" width="${w}" height="${boxH}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:${w}px;height:${boxH}px;display:flex;flex-direction:column;justify-content:center;padding:0 16px;background:${theme.cardBg};border:1px solid ${theme.border};border-left:4px solid ${accent};border-radius:12px;overflow:hidden;">
        <div style="font-size:14px;font-weight:700;line-height:1.2;color:${theme.textPrimary};">${esc(n.label)}</div>
        ${sub}
      </div>
    </foreignObject>`;
  };

  const boxes: Box[] = [];
  let body = "";
  for (let i = 0; i < rows; i++) {
    const yc = PAD + boxH / 2 + i * gapY;
    const l = left[i], r = right[i];
    const icon = theme.resolveIcon?.(l?.icon ?? r?.icon);

    // Dimension pill (left-most).
    const dimText = l?.rowLabel ?? r?.rowLabel;
    if (hasDim && dimText) {
      body += `<foreignObject x="${padL}" y="${yc - 16}" width="${dimW}" height="32">
        <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:${dimW}px;height:32px;display:flex;align-items:center;justify-content:center;text-align:center;background:${theme.accent}14;border:1px solid ${theme.border};border-radius:999px;font-size:11.5px;font-weight:700;color:${theme.textPrimary};padding:0 10px;overflow:hidden;">${esc(dimText)}</div>
      </foreignObject>`;
      body += `<line x1="${padL + dimW}" y1="${yc}" x2="${leftColLeft}" y2="${yc}" stroke="${theme.border}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    }

    if (l) { body += card(l, leftColLeft, leftColW, yc, leftAccent); boxes.push({ x: padL, y: yc - boxH / 2, w: leftColLeft + leftColW - padL, h: boxH }); }
    if (r) { body += card(r, rightColLeft, rightColW, yc, rightAccent); boxes.push({ x: rightColLeft, y: yc - boxH / 2, w: rightColW, h: boxH }); }

    // Dotted connectors into the spine.
    body += `<line x1="${leftColRight}" y1="${yc}" x2="${spineX - iconR}" y2="${yc}" stroke="${theme.border}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    body += `<line x1="${spineX + iconR}" y1="${yc}" x2="${rightColLeft}" y2="${yc}" stroke="${theme.border}" stroke-width="1.5" stroke-dasharray="3 3"/>`;

    // Center spine circle with the row's icon.
    body += `<circle cx="${spineX}" cy="${yc}" r="${iconR}" fill="${theme.cardBg}" stroke="${theme.accent}" stroke-width="2"/>`;
    if (icon) {
      body += `<svg x="${spineX - 12}" y="${yc - 12}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
    }
  }
  // Vertical spine behind the circles.
  const top = PAD, bot = PAD + boxH + (rows - 1) * gapY;
  const spine = `<line x1="${spineX}" y1="${top}" x2="${spineX}" y2="${bot}" stroke="${theme.border}" stroke-width="2"/>`;

  return svgFrame(spine + body, theme.accent, boundsOf(boxes, 30));
}
