import { env } from "@/config/env";

/**
 * Thin wrapper around Google Identity Services (GIS). Loads the script once,
 * initialises the client a single time, and exposes helpers to show the One Tap
 * prompt and render the official Google sign-in button. The credential handler
 * is held in a ref so the latest closure is always used without re-initialising.
 */

type CredentialHandler = (credential: string) => void;

const GIS_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise: Promise<void> | null = null;
let initialized = false;
let currentHandler: CredentialHandler | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Ensure GIS is loaded and initialised, with `handler` as the active callback. */
export async function ensureGoogleIdentity(
  handler: CredentialHandler,
): Promise<void> {
  if (!env.googleClientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured.");
  }
  currentHandler = handler;

  await loadScript();
  if (!window.google) {
    throw new Error("Google Identity Services did not load.");
  }

  if (!initialized) {
    window.google.accounts.id.initialize({
      client_id: env.googleClientId,
      callback: (response) => {
        if (response.credential) currentHandler?.(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      // Recent Chrome requires FedCM for the One Tap prompt to render.
      use_fedcm_for_prompt: true,
    });
    initialized = true;
  }
}

/** Show the One Tap prompt (the bubble that appears top-right). */
export function promptOneTap(): void {
  window.google?.accounts.id.prompt();
}

/** Render the official Google button into `parent`. */
export function renderGoogleButton(parent: HTMLElement): void {
  window.google?.accounts.id.renderButton(parent, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    logo_alignment: "left",
  });
}
