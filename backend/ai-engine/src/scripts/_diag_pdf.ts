import { generatePDF } from "../renderers/pdf.renderer";

// A flow-focused deck: every content slide is an auto_diagram of type "flow",
// rendered through the real generatePDF path → a genuine multi-page PDF.
export const slides: any[] = [
  {
    slideNumber: 1, recommendedLayout: "auto_diagram", headerTag: "Onboarding",
    title: "Customer Onboarding Flow",
    description: "A new signup moves through verification, then branches by plan tier before activation.",
    subtitle: "Self-serve tiers skip the manual review queue entirely.",
    diagramSpec: {
      diagramType: "flow",
      nodes: [
        { id: "signup", label: "Sign Up", icon: "user" },
        { id: "verify", label: "Verify Email", icon: "mail" },
        { id: "free", label: "Free Tier", sublabel: "instant" },
        { id: "paid", label: "Paid Tier", sublabel: "review" },
        { id: "active", label: "Activated", icon: "check-circle" },
      ],
      edges: [
        { from: "signup", to: "verify" },
        { from: "verify", to: "free", label: "self-serve" },
        { from: "verify", to: "paid", label: "enterprise" },
        { from: "free", to: "active" },
        { from: "paid", to: "active" },
      ],
    },
  },
  {
    slideNumber: 2, recommendedLayout: "auto_diagram", headerTag: "Support",
    title: "Ticket Triage Flow",
    description: "Inbound tickets are classified, then routed to the right resolution path.",
    diagramSpec: {
      diagramType: "flow",
      nodes: [
        { id: "in", label: "New Ticket", icon: "inbox" },
        { id: "triage", label: "Auto-Triage", icon: "settings" },
        { id: "bot", label: "Bot Resolves", sublabel: "L0" },
        { id: "agent", label: "Human Agent", sublabel: "L1/L2" },
        { id: "esc", label: "Escalate", sublabel: "L3", icon: "alert-triangle" },
        { id: "close", label: "Resolved", icon: "check" },
      ],
      edges: [
        { from: "in", to: "triage" },
        { from: "triage", to: "bot", label: "simple" },
        { from: "triage", to: "agent", label: "complex" },
        { from: "bot", to: "close" },
        { from: "agent", to: "close" },
        { from: "agent", to: "esc", label: "stuck" },
        { from: "esc", to: "close" },
      ],
    },
  },
  {
    slideNumber: 3, recommendedLayout: "auto_diagram", headerTag: "Data",
    title: "Event Processing Pipeline",
    description: "Raw events fan out to real-time and batch lanes, then merge into the warehouse.",
    subtitle: "Both lanes share the same schema registry for consistency.",
    diagramSpec: {
      diagramType: "flow",
      nodes: [
        { id: "src", label: "Event Source", icon: "zap" },
        { id: "queue", label: "Message Queue", icon: "layers" },
        { id: "rt", label: "Stream Proc", sublabel: "real-time" },
        { id: "batch", label: "Batch ETL", sublabel: "hourly" },
        { id: "wh", label: "Warehouse", icon: "database" },
        { id: "bi", label: "Dashboards", icon: "bar-chart" },
      ],
      edges: [
        { from: "src", to: "queue" },
        { from: "queue", to: "rt" }, { from: "queue", to: "batch" },
        { from: "rt", to: "wh" }, { from: "batch", to: "wh" },
        { from: "wh", to: "bi" },
      ],
    },
  },
];

if (import.meta.main) {
  const path = await generatePDF(
    "Flow Diagrams — Engine Demo",
    slides,
    "Three operational flows rendered by the auto-diagram engine",
    "corporate",
    "widescreen_16_9",
    null,
    false,
  );
  console.log(`✓ PDF written: ${path}`);
}
