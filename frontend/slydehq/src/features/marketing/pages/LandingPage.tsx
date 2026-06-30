import { Button } from "antd";
import { Link } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useGoogleIdentity } from "@/features/auth/hooks/use-google-identity";
import hero from "@/assets/hero.png";

/**
 * Public landing page at `/`. Shows the marketing hero and a Google sign-in at
 * the top right, and auto-prompts Google One Tap for signed-out visitors.
 */
const LandingPage = () => {
  useDocumentTitle("AI presentations in seconds");
  const { googleButtonRef, configured } = useGoogleIdentity({ oneTap: true });

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to={paths.home} className="flex items-center gap-2.5 no-underline text-inherit">
            <img src="/logo.png" alt="Slyde HQ" className="h-7 w-7 object-contain" />
            <span className="text-base font-semibold tracking-tight">Slyde HQ</span>
          </Link>

          {/* Top-right sign-in: official Google button + email fallback. */}
          <div className="flex items-center gap-4">
            <Link
              to={paths.login}
              className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline"
            >
              Sign in
            </Link>
            {/* GIS renders the official Google button into this node. */}
            <div ref={googleButtonRef} className="min-h-[40px]" />
            {!configured && (
              <Link to={paths.login}>
                <Button type="primary">Get started</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Craft winning proposals in minutes.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-500">
            Slyde HQ turns your ideas into polished, client-ready decks — so you
            spend less time formatting and more time closing.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Link to={paths.login}>
              <Button type="primary" size="large">
                Start for free
              </Button>
            </Link>
            <Link to={paths.login}>
              <Button size="large">Sign in with email</Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden border border-zinc-200 bg-zinc-900">
            <img src={hero} alt="" className="h-full w-full object-cover opacity-90" />
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-zinc-400">
          © {new Date().getFullYear()} Slyde HQ
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
