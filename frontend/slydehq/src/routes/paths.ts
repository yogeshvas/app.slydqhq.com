/**
 * Centralised route paths. Reference these everywhere (Links, navigate, guards)
 * instead of hard-coding strings, so routes can be renamed in one place.
 */
export const paths = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  googleCallback: "/auth/google/callback",
  dashboard: "/dashboard",
  create: "/create",
  createGenerate: "/create/generate",
  createOutline: "/create/generate/outline",
  deck: "/decks/:id",
  share: "/share/:token",
  media: "/media",
  templates: "/templates",
  library: "/library",
  trash: "/trash",
  settings: "/settings",
  billing: "/settings/billing",
  payment: "/payment",
} as const;

/** Build a concrete deck viewer path. */
export const deckPath = (id: string) => `/decks/${id}`;
/** Build a concrete public-share path. */
export const sharePath = (token: string) => `/share/${token}`;

export type AppPath = (typeof paths)[keyof typeof paths];
