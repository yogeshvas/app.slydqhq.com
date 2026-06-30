import { LoadingOutlined } from "@ant-design/icons";

interface Props {
  /** The planned slide title (shown faintly so the card feels real). */
  title?: string;
  index?: number;
}

/**
 * A slide-shaped shimmer placeholder shown while a slide is still generating —
 * a faux 16:9 canvas with shimmering content bars, so the generating page reads
 * as "decks are being built" instead of a blank screen.
 */
export function SlideSkeleton({ title, index }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Faux slide canvas */}
      <div className="relative aspect-video overflow-hidden border-b border-zinc-100 bg-zinc-50">
        {/* Shimmering content bars laid out like a slide */}
        <div className="absolute inset-0 flex flex-col gap-2 p-4">
          <div className="skeleton-sweep h-3 w-1/2 rounded" />
          <div className="skeleton-sweep h-2 w-3/4 rounded" />
          <div className="mt-auto flex gap-2">
            <div className="skeleton-sweep h-10 w-1/3 rounded" />
            <div className="skeleton-sweep h-10 w-1/3 rounded" />
            <div className="skeleton-sweep h-10 w-1/3 rounded" />
          </div>
        </div>
        {/* Soft generating badge */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[11px] text-indigo-500 shadow-sm backdrop-blur">
          <LoadingOutlined spin /> Generating
        </div>
      </div>
      {/* Footer with the planned title */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        {title ? (
          <span className="truncate text-[13px] text-zinc-500" title={title}>
            {index != null ? `${index}. ` : ""}
            {title}
          </span>
        ) : (
          <div className="skeleton-sweep h-3 w-2/3 rounded" />
        )}
        <span className="h-4 w-8 rounded skeleton-sweep" />
      </div>
    </div>
  );
}
