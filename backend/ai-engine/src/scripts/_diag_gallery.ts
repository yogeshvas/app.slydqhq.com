import puppeteer from "puppeteer";
import { renderSlideHTML, getDeckStyles } from "../renderers/pdf.renderer";
import type { ThemeName } from "../config/themes";

const OUT = process.env.DIAG_OUT ?? "generated";

interface Case { name: string; theme: ThemeName; slide: any; }

const cases: Case[] = [
  // 1 — TREE, deeper taxonomy, corporate
  {
    name: "tree-deployment", theme: "corporate",
    slide: {
      slideNumber: 1, recommendedLayout: "auto_diagram", headerTag: "Cloud Models",
      title: "Deployment Models, Decomposed",
      description: "Every workload lands in one of three deployment models — each splits further by control and responsibility.",
      subtitle: "Hybrid is the destination for most regulated enterprises.",
      diagramSpec: {
        diagramType: "tree",
        nodes: [
          { id: "r", label: "Deployment", icon: "cloud" },
          { id: "pub", label: "Public", sublabel: "Shared", icon: "globe" },
          { id: "priv", label: "Private", sublabel: "Dedicated", icon: "lock" },
          { id: "hyb", label: "Hybrid", sublabel: "Mixed", icon: "layers" },
          { id: "iaas", label: "IaaS", icon: "server" },
          { id: "saas", label: "SaaS", icon: "settings" },
          { id: "onprem", label: "On-Prem", icon: "cpu" },
        ],
        edges: [
          { from: "r", to: "pub" }, { from: "r", to: "priv" }, { from: "r", to: "hyb" },
          { from: "pub", to: "iaas" }, { from: "pub", to: "saas" }, { from: "priv", to: "onprem" },
        ],
      },
    },
  },

  // 2 — FLOW, branching + merge pipeline, corporate
  {
    name: "flow-cicd", theme: "corporate",
    slide: {
      slideNumber: 2, recommendedLayout: "auto_diagram", headerTag: "Delivery",
      title: "CI/CD Pipeline with Quality Gates",
      description: "Code branches into parallel test suites, then reconverges before a gated production deploy.",
      diagramSpec: {
        diagramType: "flow",
        nodes: [
          { id: "commit", label: "Commit", icon: "send" },
          { id: "build", label: "Build", icon: "cpu" },
          { id: "unit", label: "Unit Tests", sublabel: "fast" },
          { id: "e2e", label: "E2E Tests", sublabel: "slow" },
          { id: "gate", label: "Gate", icon: "shield-check" },
          { id: "prod", label: "Production", icon: "globe" },
        ],
        edges: [
          { from: "commit", to: "build" },
          { from: "build", to: "unit" }, { from: "build", to: "e2e" },
          { from: "unit", to: "gate" }, { from: "e2e", to: "gate" },
          { from: "gate", to: "prod", label: "approve" },
        ],
      },
    },
  },

  // 3 — CYCLE, 5 nodes, corporate
  {
    name: "cycle-growth", theme: "corporate",
    slide: {
      slideNumber: 3, recommendedLayout: "auto_diagram", headerTag: "Growth Engine",
      title: "The Product-Led Growth Loop",
      subtitle: "Each happy user becomes an acquisition channel for the next.",
      diagramSpec: {
        diagramType: "cycle", title: "PLG",
        nodes: [
          { id: "acq", label: "Acquire", icon: "users" },
          { id: "act", label: "Activate", icon: "zap" },
          { id: "eng", label: "Engage", icon: "activity" },
          { id: "ref", label: "Refer", icon: "send" },
          { id: "rev", label: "Monetize", icon: "dollar-sign" },
        ],
      },
    },
  },

  // 4 — TREE horizontal direction, corporate
  {
    name: "tree-horizontal-decision", theme: "corporate",
    slide: {
      slideNumber: 4, recommendedLayout: "auto_diagram", headerTag: "Decision Tree",
      title: "Choosing a Data Store",
      description: "Start from the access pattern, not the technology.",
      diagramSpec: {
        diagramType: "tree", direction: "horizontal",
        nodes: [
          { id: "q", label: "Access Pattern?", icon: "target" },
          { id: "rel", label: "Relational", sublabel: "joins" },
          { id: "kv", label: "Key-Value", sublabel: "lookups" },
          { id: "doc", label: "Document", sublabel: "nested" },
          { id: "pg", label: "Postgres" },
          { id: "redis", label: "Redis" },
          { id: "mongo", label: "MongoDB" },
        ],
        edges: [
          { from: "q", to: "rel" }, { from: "q", to: "kv" }, { from: "q", to: "doc" },
          { from: "rel", to: "pg" }, { from: "kv", to: "redis" }, { from: "doc", to: "mongo" },
        ],
      },
    },
  },

  // 5 — COMPARISON, funky theme (test theming)
  {
    name: "comparison-funky", theme: "funky",
    slide: {
      slideNumber: 5, recommendedLayout: "auto_diagram", headerTag: "Before / After",
      title: "Manual Ops vs Automated Platform",
      description: "The shift is from human-paced firefighting to event-driven self-healing.",
      diagramSpec: {
        diagramType: "comparison", title: "shift",
        nodes: [
          { id: "l1", group: "left", label: "Ticket queues", sublabel: "hours" },
          { id: "l2", group: "left", label: "Manual deploys" },
          { id: "l3", group: "left", label: "Reactive alerts" },
          { id: "r1", group: "right", label: "Self-service", sublabel: "seconds" },
          { id: "r2", group: "right", label: "Auto deploys" },
          { id: "r3", group: "right", label: "Predictive healing" },
        ],
      },
    },
  },

  // 6 — TREE, academic theme (test theming)
  {
    name: "tree-academic", theme: "academic",
    slide: {
      slideNumber: 6, recommendedLayout: "auto_diagram", headerTag: "Taxonomy",
      title: "Machine Learning, At a Glance",
      description: "Three learning paradigms branch into the methods practitioners actually reach for.",
      diagramSpec: {
        diagramType: "tree",
        nodes: [
          { id: "ml", label: "Machine Learning", icon: "cpu" },
          { id: "sup", label: "Supervised", icon: "target" },
          { id: "uns", label: "Unsupervised", icon: "layers" },
          { id: "rl", label: "Reinforcement", icon: "refresh-cw" },
          { id: "cls", label: "Classification" },
          { id: "reg", label: "Regression" },
          { id: "clu", label: "Clustering" },
        ],
        edges: [
          { from: "ml", to: "sup" }, { from: "ml", to: "uns" }, { from: "ml", to: "rl" },
          { from: "sup", to: "cls" }, { from: "sup", to: "reg" }, { from: "uns", to: "clu" },
        ],
      },
    },
  },
];

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1333, height: 750, deviceScaleFactor: 2 });

for (const c of cases) {
  const styles = getDeckStyles(c.theme, "widescreen_16_9", null);
  const frag = renderSlideHTML(c.slide, c.theme, "widescreen_16_9", null, false);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head><body>${frag}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  const el = await page.$(".slide");
  await el!.screenshot({ path: `${OUT}/gallery-${c.name}.png` });
  console.log(`✓ gallery-${c.name}.png  (${c.slide.diagramSpec.diagramType}, ${c.theme})`);
}
await browser.close();
console.log("done");
