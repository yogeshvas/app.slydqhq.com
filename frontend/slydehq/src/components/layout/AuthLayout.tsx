import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { paths } from "@/routes/paths";
import hero from "@/assets/hero.png";

type Props = {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Optional footer line under the form (e.g. "Don't have an account?"). */
  footer?: ReactNode;
  /** Optional visual for the left brand panel (replaces the hero image). */
  background?: ReactNode;
};

const Brand = ({ size = 7 }: { size?: 7 | 8 }) => (
  <Link
    to={paths.home}
    className="flex items-center gap-2.5 no-underline text-inherit"
  >
    <img
      src="/logo.png"
      alt="Slyde HQ"
      className={size === 8 ? "h-8 w-8 object-contain" : "h-7 w-7 object-contain"}
    />
    <span className="text-base font-semibold tracking-tight">Slyde HQ</span>
  </Link>
);

/**
 * Split-screen shell for auth pages: a dark brand panel on the left (hidden on
 * mobile) and a centred form column on the right. Pages supply only the form.
 */
const AuthLayout = ({ title, subtitle, children, footer, background }: Props) => (
  <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-zinc-50 text-[14px]">
    {/* Brand / hero panel — hidden on small screens. */}
    <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-zinc-900 p-10 text-white">
      {background ? (
        <div className="absolute inset-0 opacity-40">{background}</div>
      ) : (
        <div
          className="absolute inset-0 opacity-[0.15] bg-cover bg-center mix-blend-luminosity"
          style={{ backgroundImage: `url(${hero})` }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 via-zinc-900/80 to-zinc-800/40" />

      <div className="relative">
        <Brand />
      </div>

      <div className="relative max-w-sm">
        <h2 className="text-2xl font-semibold leading-snug">
          Craft winning proposals in minutes.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          Slyde HQ turns your ideas into polished, client-ready decks — so you
          spend less time formatting and more time closing.
        </p>
      </div>

      <p className="relative text-xs text-zinc-400">
        © {new Date().getFullYear()} Slyde HQ
      </p>
    </aside>

    {/* Form panel. */}
    <main className="flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[340px]">
        {/* Logo for mobile (brand panel is hidden there). */}
        <div className="mb-8 lg:hidden">
          <Brand size={8} />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>

        {children}

        {footer && (
          <p className="mt-7 text-center text-sm text-zinc-500">{footer}</p>
        )}
      </div>
    </main>
  </div>
);

export default AuthLayout;
