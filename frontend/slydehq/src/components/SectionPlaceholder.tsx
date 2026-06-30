import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Friendly empty/placeholder state for sections that aren't built out yet. */
export default function SectionPlaceholder({
  icon,
  title,
  description,
  action,
}: Props) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-zinc-100 text-[26px] text-zinc-400">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
          {description}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
