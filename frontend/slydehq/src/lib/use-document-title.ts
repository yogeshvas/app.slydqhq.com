import { useEffect } from "react";
import { env } from "@/config/env";

/**
 * Set the browser tab/document title for the current page. Pass the page-specific
 * label; the app name is appended. Pass an empty string to show just the app name.
 *
 *   useDocumentTitle("Decks")            → "Decks · Slyde HQ"
 *   useDocumentTitle(deck?.title ?? "")  → "<deck title> · Slyde HQ"
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const t = title.trim();
    document.title = t ? `${t} · ${env.appName}` : env.appName;
  }, [title]);
}
