import { useState } from "react";
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  ImportOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
  SwapOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FolderOpenOutlined as FolderOpenIcon,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import {
  App as AntApp,
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Segmented,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import { deckPath, paths } from "@/routes/paths";
import { timeAgo } from "@/lib/utils";
import { isApiError } from "@/lib/api-client";
import {
  useDecks,
  useToggleFavorite,
  useTrashDeck,
} from "@/features/decks/hooks/use-decks";
import { LazyThumb } from "@/features/decks/components/LazyThumb";
import { DashboardGuide } from "../components/DashboardGuide";
import { useFolders, useMoveDeck } from "@/features/folders/hooks/use-folders";
import { DECK_DRAG_KEY } from "@/features/folders/components/FoldersSection";
import { useDocumentTitle } from "@/lib/use-document-title";
import type {
  DeckFilter,
  DeckStatus,
  DeckSummary,
} from "@/features/decks/types/deck.types";

const STATUS_TAG: Record<DeckStatus, { color: string; label: string }> = {
  draft: { color: "default", label: "Draft" },
  generating: { color: "processing", label: "Generating" },
  ready: { color: "success", label: "Ready" },
  archived: { color: "default", label: "Archived" },
};

const TABS: { key: DeckFilter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <FolderOpenOutlined /> },
  { key: "recent", label: "Recently viewed", icon: <ClockCircleOutlined /> },
  { key: "created", label: "Created by you", icon: <UserOutlined /> },
  { key: "favorites", label: "Favorites", icon: <StarOutlined /> },
];

const DashboardPage = () => {
  useDocumentTitle("Decks");
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [params] = useSearchParams();
  const folderId = params.get("folder") ?? undefined;

  const [filter, setFilter] = useState<DeckFilter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [desc, setDesc] = useState(true);

  const sort = filter === "recent" ? "viewed" : "updated";
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useDecks({ filter, sort, desc, folderId });
  const favorite = useToggleFavorite();
  const trash = useTrashDeck();
  const { data: folders = [] } = useFolders();
  const move = useMoveDeck();

  const activeFolder = folders.find((f) => f._id === folderId);
  const decks = data?.pages.flatMap((p) => p.decks) ?? [];

  // ⋯ menu: favorite, move into / out of a folder, or to trash.
  const deckMenu = (deck: DeckSummary): MenuProps["items"] => [
    {
      key: "fav",
      icon: deck.favorite ? <StarFilled className="!text-amber-400" /> : <StarOutlined />,
      label: deck.favorite ? "Remove from favorites" : "Add to favorites",
      onClick: () => favorite.mutate({ id: deck._id, favorite: !deck.favorite }),
    },
    { type: "divider" as const },
    ...(folders.length
      ? [
          {
            key: "move",
            icon: <FolderOpenIcon />,
            label: "Move to folder",
            children: folders.map((f) => ({
              key: f._id,
              icon: <FolderOpenIcon style={{ color: f.color }} />,
              label: f.name,
              onClick: () => doMove(deck._id, f._id),
            })),
          },
        ]
      : []),
    // Only when the deck is actually filed under a folder.
    ...(deck.folderId
      ? [
          {
            key: "none",
            label: "Remove from folder",
            onClick: () => doMove(deck._id, null),
          },
        ]
      : []),
    { type: "divider" as const },
    {
      key: "trash",
      danger: true,
      icon: <DeleteOutlined />,
      label: "Move to trash",
      onClick: () => void doTrash(deck._id),
    },
  ];

  const doMove = async (deckId: string, target: string | null) => {
    try {
      await move.mutateAsync({ deckId, folderId: target });
      message.success(target ? "Moved to folder." : "Removed from folder.");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't move deck.");
    }
  };

  const doTrash = async (deckId: string) => {
    try {
      await trash.mutateAsync(deckId);
      message.success("Moved to trash.");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't move to trash.");
    }
  };

  // "Recently viewed" labels by last view; other tabs by last update.
  const subtitle = (d: DeckSummary) =>
    filter === "recent" && d.lastViewedAt
      ? `Viewed ${timeAgo(d.lastViewedAt)}`
      : `Updated ${timeAgo(d.updatedAt)}`;

  const Star = ({ d }: { d: DeckSummary }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        favorite.mutate({ id: d._id, favorite: !d.favorite });
      }}
      className="text-zinc-300 transition-colors hover:text-amber-400"
      title={d.favorite ? "Unfavorite" : "Add to favorites"}
    >
      {d.favorite ? <StarFilled className="!text-amber-400" /> : <StarOutlined />}
    </button>
  );

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={activeFolder ? activeFolder.name : "Decks"}
        icon={
          activeFolder ? (
            <FolderOpenIcon style={{ color: activeFolder.color }} />
          ) : (
            <FolderOpenOutlined />
          )
        }
      />

      {activeFolder && (
        <button
          type="button"
          onClick={() => navigate(paths.dashboard)}
          className="mb-4 flex items-center gap-1.5 text-[13px] text-zinc-500 transition-colors hover:text-indigo-600"
        >
          <ArrowLeftOutlined /> All decks
        </button>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="shimmer-border inline-flex !rounded-full">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(paths.create)}
          >
            Create new
            <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold leading-none">
              AI
            </span>
          </Button>
        </span>
        <Button icon={<ImportOutlined />} disabled>
          Import
        </Button>
      </div>

      {/* Tabs + view controls */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as DeckFilter)}
          options={TABS.map((t) => ({
            value: t.key,
            label: (
              <span className="flex items-center gap-1.5">
                {t.icon}
                {t.label}
              </span>
            ),
          }))}
        />
        <div className="flex items-center gap-2">
          <Tooltip title="Reverse sort order">
            <Button
              size="small"
              icon={<SwapOutlined rotate={90} />}
              onClick={() => setDesc((d) => !d)}
            />
          </Tooltip>
          <Segmented
            size="small"
            value={view}
            onChange={(v) => setView(v as "grid" | "list")}
            options={[
              { value: "grid", icon: <AppstoreOutlined />, label: "Grid" },
              { value: "list", icon: <UnorderedListOutlined />, label: "List" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spin size="large" />
        </div>
      ) : decks.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              filter === "favorites"
                ? "No favorites yet — star a deck to pin it here."
                : filter === "recent"
                  ? "Nothing viewed yet."
                  : "No decks yet — generate your first one."
            }
          >
            {filter === "all" && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate(paths.create)}
              >
                Create with AI
              </Button>
            )}
          </Empty>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {decks.map((deck) => {
            const tag = STATUS_TAG[deck.status] ?? STATUS_TAG.draft;
            return (
              <Card
                key={deck._id}
                hoverable
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData(DECK_DRAG_KEY, deck._id)
                }
                styles={{ body: { padding: 16 } }}
                className="overflow-hidden"
                onClick={() => navigate(deckPath(deck._id))}
                cover={
                  deck.thumbnailHtml ? (
                    <LazyThumb
                      html={deck.thumbnailHtml}
                      css={deck.styleCss ?? ""}
                      canvas={deck.canvas}
                    />
                  ) : deck.thumbnailUrl ? (
                    <img
                      src={deck.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-video place-items-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-white/80">
                      <FileTextOutlined style={{ fontSize: 28 }} />
                    </div>
                  )
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <Typography.Text strong className="truncate" title={deck.title}>
                    {deck.title}
                  </Typography.Text>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Star d={deck} />
                    <Tag color={tag.color} className="!m-0">
                      {tag.label}
                    </Tag>
                    <Dropdown
                trigger={["click"]}
                menu={{
                  items: deckMenu(deck),
                  // Menu renders in a portal — React events still bubble through the
                  // component tree to the Card's onClick. Stop it so picking a menu
                  // item doesn't also open the deck.
                  onClick: ({ domEvent }) => domEvent.stopPropagation(),
                }}
              >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                        className="px-0.5 text-zinc-400 hover:text-zinc-700"
                      >
                        ⋯
                      </span>
                    </Dropdown>
                  </div>
                </div>
                <Typography.Text type="secondary" className="mt-1 block text-[12px]">
                  {subtitle(deck)}
                </Typography.Text>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="border border-zinc-200">
          <div className="grid grid-cols-[1fr_140px_140px_40px] items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[12px] font-medium text-zinc-500">
            <span>Title</span>
            <span>{filter === "recent" ? "Last viewed" : "Last updated"}</span>
            <span>Creator</span>
            <span />
          </div>
          {decks.map((deck) => (
            <div
              key={deck._id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DECK_DRAG_KEY, deck._id)}
              onClick={() => navigate(deckPath(deck._id))}
              className="grid cursor-pointer grid-cols-[1fr_140px_140px_40px] items-center gap-3 border-b border-zinc-100 px-4 py-3 transition-colors last:border-0 hover:bg-zinc-50"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Star d={deck} />
                <div className="h-9 w-16 shrink-0 overflow-hidden border border-zinc-200">
                  {deck.thumbnailHtml ? (
                    <LazyThumb
                      html={deck.thumbnailHtml}
                      css={deck.styleCss ?? ""}
                      canvas={deck.canvas}
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-zinc-100 text-zinc-300">
                      <FileTextOutlined />
                    </div>
                  )}
                </div>
                <span className="truncate text-[14px] text-zinc-800" title={deck.title}>
                  {deck.title}
                </span>
              </div>
              <span className="text-[12px] text-zinc-500">
                {filter === "recent" && deck.lastViewedAt
                  ? timeAgo(deck.lastViewedAt)
                  : timeAgo(deck.updatedAt)}
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-zinc-600">
                <Avatar
                  size={20}
                  src={deck.creator?.avatar || undefined}
                  icon={<UserOutlined />}
                />
                <span className="truncate">{deck.creator?.name ?? "—"}</span>
              </span>
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: deckMenu(deck),
                  // Menu renders in a portal — React events still bubble through the
                  // component tree to the Card's onClick. Stop it so picking a menu
                  // item doesn't also open the deck.
                  onClick: ({ domEvent }) => domEvent.stopPropagation(),
                }}
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                  className="justify-self-center px-1 text-zinc-400 hover:text-zinc-700"
                >
                  ⋯
                </span>
              </Dropdown>
            </div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}

      <DashboardGuide />
    </div>
  );
};

export default DashboardPage;
