import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { paths } from "@/routes/paths";
import Rail from "./Rail";
import { activeSection } from "./nav";
import { DeckSearchModal } from "@/features/decks/components/DeckSearchModal";
import { useCommandPalette } from "@/features/decks/store/command-palette.store";
import { useReferralClaim } from "@/features/referral/hooks/use-referral";
import { useInviteClaim } from "@/features/members/hooks/use-invite";

/**
 * Authenticated layout route: the icon rail + an optional contextual secondary
 * panel for the active section + the page outlet. Pages render their own
 * headers (see PageHeader), so this stays purely structural.
 */
export default function AppLayout() {
  const location = useLocation();
  const section = activeSection(location.pathname);
  const { open, setOpen, toggle } = useCommandPalette();

  // Redeem a pending ?ref= invite once the user is authenticated.
  useReferralClaim();
  // Auto-accept a pending workspace invite captured before sign-in.
  useInviteClaim();

  // Global ⌘K / Ctrl+K opens the deck search palette anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Focused flows (generate, view a deck) get the full width — rail only.
  const focused =
    location.pathname.startsWith(paths.create) ||
    location.pathname.startsWith("/decks/");
  const Secondary = focused ? null : section.secondary;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Rail />
      {Secondary && <Secondary />}
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
      <DeckSearchModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
