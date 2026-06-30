import { useEffect, useRef, useState } from "react";
import { SearchOutlined, UploadOutlined } from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Empty,
  Input,
  Pagination,
  Segmented,
  Select,
  Spin,
} from "antd";
import { isApiError } from "@/lib/api-client";
import {
  useDeleteMedia,
  useMedia,
  useMediaTags,
  useUpdateMediaTags,
  useUploadMedia,
} from "../hooks/use-media";
import type { MediaItem, MediaSource, MediaTab } from "../types";
import { MediaCard } from "./MediaCard";
import { MediaTagsModal } from "./MediaTagsModal";

const TABS: { label: string; value: MediaTab }[] = [
  { label: "All", value: "all" },
  { label: "AI generated", value: "ai" },
  { label: "Stock", value: "unsplash" },
  { label: "Uploaded", value: "upload" },
];

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif";

interface Props {
  /** Picker mode (editor panel): clicking a tile applies the image. */
  onPick?: (item: MediaItem) => void;
  /** Compact grid for the narrow editor side panel. */
  compact?: boolean;
}

/**
 * The full media browser: tabs, server-side search, tag filter, upload, grid and
 * paging. Reused by the dashboard Media page and the editor's Media panel.
 */
export function MediaLibrary({ onPick, compact }: Props) {
  const { message } = AntApp.useApp();
  const [tab, setTab] = useState<MediaTab>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const limit = compact ? 24 : 40;

  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Any filter change resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [tab, debouncedQ, tags]);

  const { data, isLoading, isFetching } = useMedia({
    source: tab === "all" ? undefined : (tab as MediaSource),
    q: debouncedQ,
    tags,
    page,
    limit,
  });
  const { data: allTags } = useMediaTags();

  const upload = useUploadMedia();
  const del = useDeleteMedia();
  const updateTags = useUpdateMediaTags();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
        message.success(`Uploaded ${file.name}`);
      } catch (err) {
        message.error(
          isApiError(err) ? err.message : `Couldn't upload ${file.name}`,
        );
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDelete = async (item: MediaItem) => {
    try {
      await del.mutateAsync(item._id);
      message.success("Deleted.");
    } catch (err) {
      message.error(isApiError(err) ? err.message : "Couldn't delete.");
    }
  };

  const onSaveTags = async (id: string, next: string[]) => {
    try {
      await updateTags.mutateAsync({ id, tags: next });
      setEditing(null);
      message.success("Tags updated.");
    } catch (err) {
      message.error(isApiError(err) ? err.message : "Couldn't save tags.");
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="space-y-2">
        <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "justify-between"}`}>
          <Segmented
            size={compact ? "small" : "middle"}
            value={tab}
            onChange={(v) => setTab(v as MediaTab)}
            options={TABS}
          />
          {!compact && (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            allowClear
            prefix={<SearchOutlined className="text-zinc-400" />}
            placeholder="Search by content, tags, prompt…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={compact ? "!w-full" : "!max-w-xs"}
          />
          <Select
            mode="multiple"
            allowClear
            value={tags}
            onChange={setTags}
            placeholder="Filter by tag"
            options={(allTags ?? []).map((t) => ({ label: t, value: t }))}
            className={compact ? "!w-full" : "!min-w-[180px]"}
            maxTagCount="responsive"
          />
          {compact && (
            <Button
              icon={<UploadOutlined />}
              loading={upload.isPending}
              onClick={() => fileRef.current?.click()}
              block
            >
              Upload
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />

      {/* Grid */}
      <div className="relative mt-3 min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty
            className="py-16"
            description={
              debouncedQ || tags.length
                ? "No media matches your search."
                : "No media yet. Generate a deck or upload images to start your library."
            }
          />
        ) : (
          <div
            className={`grid gap-2 ${
              compact
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            } ${isFetching ? "opacity-60 transition-opacity" : ""}`}
          >
            {items.map((item) => (
              <MediaCard
                key={item._id}
                item={item}
                onPick={onPick}
                onEditTags={onPick ? undefined : setEditing}
                onDelete={onPick ? undefined : onDelete}
                deleting={del.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex justify-center border-t border-zinc-100 pt-3">
          <Pagination
            size="small"
            current={page}
            total={data.total}
            pageSize={limit}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      )}

      <MediaTagsModal
        item={editing}
        saving={updateTags.isPending}
        onSave={onSaveTags}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
