import { DeleteOutlined, TagOutlined } from "@ant-design/icons";
import { Button, Popconfirm, Tooltip } from "antd";
import type { MediaItem, MediaSource } from "../types";

const SOURCE_META: Record<MediaSource | "export", { label: string; className: string }> = {
  ai: { label: "AI", className: "bg-indigo-600" },
  unsplash: { label: "Stock", className: "bg-emerald-600" },
  upload: { label: "Upload", className: "bg-amber-600" },
  export: { label: "Export", className: "bg-zinc-600" },
};

interface Props {
  item: MediaItem;
  /** Picker mode: clicking the tile applies the image (editor panel). */
  onPick?: (item: MediaItem) => void;
  /** Manage mode: edit tags / delete (library page). */
  onEditTags?: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
  deleting?: boolean;
}

/** One media tile: thumbnail, source badge, title/tags, and hover actions. */
export function MediaCard({ item, onPick, onEditTags, onDelete, deleting }: Props) {
  const src = SOURCE_META[item.source] ?? SOURCE_META.export;
  const caption = item.title || item.originalFilename || item.meta?.prompt || "Untitled";
  const tags = [...item.tags, ...item.aiTags].slice(0, 4);
  const pickable = Boolean(onPick);

  return (
    <div className="group relative aspect-[4/3] overflow-hidden border border-zinc-200 bg-zinc-50">
      <img
        src={item.url}
        alt={caption}
        loading="lazy"
        className="h-full w-full object-cover"
      />

      {/* Source badge */}
      <span
        className={`absolute left-1.5 top-1.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${src.className}`}
      >
        {src.label}
      </span>

      {/* "Analyzing" hint while AI metadata is still being derived */}
      {item.metaStatus === "pending" && (
        <span className="absolute right-1.5 top-1.5 bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
          Analyzing…
        </span>
      )}

      {/* Hover overlay: caption + tags, plus actions */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="p-2">
          <div className="truncate text-[12px] font-medium text-white">{caption}</div>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="bg-white/20 px-1 py-px text-[10px] text-white"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {pickable ? (
        <button
          type="button"
          onClick={() => onPick?.(item)}
          className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span className="bg-white px-3 py-1 text-[12px] font-semibold text-zinc-900 shadow">
            Use image
          </span>
        </button>
      ) : (
        <div className="pointer-events-none absolute right-1.5 bottom-1.5 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          {onEditTags && (
            <Tooltip title="Edit tags">
              <Button
                size="small"
                icon={<TagOutlined />}
                onClick={() => onEditTags(item)}
              />
            </Tooltip>
          )}
          {onDelete && (
            <Popconfirm
              title="Delete this media?"
              description="It will be removed from your library."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(item)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} loading={deleting} />
            </Popconfirm>
          )}
        </div>
      )}
    </div>
  );
}
