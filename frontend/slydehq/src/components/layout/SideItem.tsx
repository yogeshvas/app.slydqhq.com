import type { ReactNode } from "react";
import { Tag } from "antd";

interface Props {
  icon: ReactNode;
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** Right-aligned hint, e.g. a shortcut or a "Soon" tag. */
  hint?: ReactNode;
  onClick?: () => void;
}

/** A single row in a secondary sidebar panel (Home nav, Settings nav, …). */
export default function SideItem({
  icon,
  label,
  active,
  disabled,
  hint,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[14px] transition-colors",
        disabled
          ? "cursor-default text-zinc-400"
          : active
            ? "bg-indigo-50 font-medium text-indigo-700"
            : "text-zinc-700 hover:bg-zinc-100",
      ].join(" ")}
    >
      <span className="text-[16px]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint &&
        (typeof hint === "string" ? (
          <Tag className="!m-0 !text-[10px] !leading-4">{hint}</Tag>
        ) : (
          hint
        ))}
    </button>
  );
}
