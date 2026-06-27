import { generatePDF } from "../renderers/pdf.renderer";
import { resolveAccentOverride } from "../config/accentColors";

const slides = [
  {
    slideNumber: 1,
    slideType: "text_chart",
    recommendedLayout: "text_chart",
    headerTag: "MARKET DATA",
    title: "Channel Open Rate Comparison",
    subtitle: "WhatsApp & SMS outperform email on every engagement metric",
    description: "Reach customers on channels they actually use.",
    bulletPoints: [
      "WhatsApp Adoption — 72% of active mobile users already use WhatsApp daily",
      "SMS Open Rate — 90% open rate within 2 minutes of delivery",
      "Email Open Rate — 20% average open rate falls far behind messaging channels",
      "Engagement Uplift — 40% campaign performance improvement",
    ],
    chartBars: [
      { label: "WhatsApp Open Rate", value: 98 },
      { label: "SMS Open Rate", value: 90 },
      { label: "Push Notification", value: 56 },
      { label: "Email Open Rate", value: 20 },
    ],
  },
  {
    slideNumber: 2,
    slideType: "pricing",
    recommendedLayout: "minimal",
    title: "WhatsApp & SMS Pricing Tiers",
    subtitle: "Transparent, scalable pricing aligned to usage and channels",
    description: "Simple tiers that scale with your message volume and feature needs.",
    bulletPoints: [
      "Starter — $199/month — WhatsApp & SMS, up to 5,000 messages/month, core features",
      "Growth — $499/month — WhatsApp & SMS, up to 25,000 messages/month, automation & analytics",
      "Scale — $899/month — WhatsApp & SMS, up to 100,000 messages/month, dedicated success engineer",
      "Enterprise — Custom pricing — unlimited messages, API access, 24/7 concierge support",
    ],
  },
  {
    slideNumber: 3,
    slideType: "implementation_timeline",
    recommendedLayout: "staggered_phases",
    headerTag: "IMPLEMENTATION",
    title: "Implementation Timeline",
    subtitle: "A concise weekly plan to deliver baseline engagement channels",
    phases: [
      { name: "Commercial Approval & Project Kickoff", period: "Week 1 (Jun 22–28, 2026)", bullets: ["Align scope, success criteria, and RACI with stakeholders"] },
      { name: "Business Verification & Account Setup", period: "Week 2 (Jun 29–Jul 5, 2026)", bullets: ["WhatsApp API provisioning, domain verification, and access controls"] },
      { name: "Platform Configuration, SMS Setup & Testing", period: "Week 3 (Jul 6–12, 2026)", bullets: ["Channel mapping, test scripts, and integration checks"] },
      { name: "Training, UAT & Go-Live", period: "Week 4 (Jul 13–19, 2026)", bullets: ["End-user training, sign-off, and production cutover plan"] },
    ],
  },
];

const accentOverride = resolveAccentOverride("blue");
const pdfPath = await generatePDF("Visual Fix Test", slides as any, "test theme", "corporate", "widescreen_16_9", accentOverride);
console.log("PDF →", pdfPath);
