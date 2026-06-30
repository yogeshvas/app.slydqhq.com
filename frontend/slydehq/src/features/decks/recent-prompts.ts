/**
 * Recent prompts, persisted in localStorage. We don't have a server-side prompt
 * history endpoint yet, so the create screen reads from here; once a `GET /jobs`
 * (or similar) exists this can be swapped for a query without touching the UI.
 */
const KEY = "slydehq.recentPrompts";
const MAX = 6;

export function getRecentPrompts(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentPrompt(prompt: string): void {
  const p = prompt.trim();
  if (!p) return;
  const next = [p, ...getRecentPrompts().filter((x) => x !== p)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

/** Pool of starter prompts shown when there's no history (clickable to seed). */
export const EXAMPLE_PROMPT_POOL = [
  "A pitch deck for an AI-powered proposal tool targeting agencies",
  "A go-to-market plan for a new product launch",
  "An onboarding guide for new engineering hires",
  "A sales deck for a B2B SaaS platform",
  "A quarterly business review for stakeholders",
  "A workshop on effective remote collaboration",
  "How to brew the perfect cup of espresso",
  "Unconventional marketing successes and failures",
  "A classroom management plan for new teachers",
  "Marketing strategies for nonprofits",
  "An investor update for a seed-stage startup",
  "A product roadmap for the next two quarters",
];

/** First 6, used by the create screen's fallback list. */
export const EXAMPLE_PROMPTS = EXAMPLE_PROMPT_POOL.slice(0, 6);

/** A random `n` example prompts (for the Generate page's shuffle). */
export function sampleExamplePrompts(n = 6): string[] {
  return [...EXAMPLE_PROMPT_POOL].sort(() => Math.random() - 0.5).slice(0, n);
}
