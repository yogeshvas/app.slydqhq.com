import type { ReactNode } from "react";
import { useState } from "react";
import {
  CodeOutlined,
  CrownOutlined,
  DeleteOutlined,
  DownOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { App as AntApp, Avatar, Button, Popover } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import { useTrashDeck } from "@/features/decks/hooks/use-decks";
import { useCommandPalette } from "@/features/decks/store/command-palette.store";
import { FoldersSection, DECK_DRAG_KEY } from "@/features/folders/components/FoldersSection";
import SideItem from "../SideItem";

const initials = (value?: string) =>
  value ? value.slice(0, 2).toUpperCase() : "U";

/** A row in the workspace-switcher popover. */
function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] text-zinc-700 transition-colors hover:bg-zinc-100"
    >
      <span className="text-[16px] text-zinc-500">{icon}</span>
      {label}
    </button>
  );
}

/** Contextual panel for the Home section: workspace, upgrade, deck nav. */
export default function HomeSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const openSearch = useCommandPalette((s) => s.setOpen);

  const onDecks = location.pathname.startsWith(paths.dashboard);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const switcherPanel = (
    <div className="w-80">
      <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
        <Avatar shape="square" size="large" className="bg-amber-400 text-zinc-900">
          {initials(workspace?.name)}
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold text-zinc-900">
            {workspace?.name ?? "Workspace"}
          </div>
          <div className="text-xs capitalize text-zinc-400">
            {workspace?.plan ?? "free"} · 1 member
          </div>
        </div>
        <Button size="small" onClick={() => go(paths.settings)}>
          Settings
        </Button>
      </div>

      <div className="my-1 h-px bg-zinc-100" />

      <MenuRow
        icon={<UsergroupAddOutlined />}
        label="Invite teammates"
        onClick={() => go("/settings/members")}
      />
      <MenuRow
        icon={<CrownOutlined />}
        label="Plans and pricing"
        onClick={() => go(paths.settings)}
      />
    </div>
  );

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 lg:flex">
      {/* Workspace switcher */}
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomLeft"
        arrow={false}
        content={switcherPanel}
        styles={{ content: { padding: 6 } }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 hover:bg-zinc-50"
        >
          <Avatar shape="square" className="bg-amber-400 text-zinc-900">
            {initials(workspace?.name)}
          </Avatar>
          <div className="min-w-0 flex-1 text-left leading-tight">
            <div className="truncate text-[13px] font-semibold text-zinc-900">
              {workspace?.name ?? "Workspace"}
            </div>
            <div className="text-[11px] capitalize text-zinc-400">
              {workspace?.plan ?? "free"}
            </div>
          </div>
          <DownOutlined className="text-[10px] text-zinc-400" />
        </button>
      </Popover>

      {/* Upgrade */}
      <Button
        block
        className="my-3 !font-medium"
        icon={<ThunderboltOutlined />}
        onClick={() => navigate(paths.settings)}
      >
        Upgrade for more AI
      </Button>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        <SideItem
          icon={<FolderOpenOutlined />}
          label="Decks"
          active={onDecks}
          onClick={() => navigate(paths.dashboard)}
        />
        <SideItem
          icon={<SearchOutlined />}
          label="Search"
          hint="⌘K"
          onClick={() => openSearch(true)}
        />
        <SideItem icon={<CodeOutlined />} label="API generated" hint="Soon" disabled />
      </nav>

      {/* Folders — create, list, drag decks in */}
      <FoldersSection />

      <div className="mt-auto border-t border-zinc-100 pt-2">
        <TrashItem active={location.pathname.startsWith(paths.trash)} />
      </div>
    </aside>
  );
}

/** Trash nav item — click to open, or drag a deck card onto it to delete. */
function TrashItem({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const trash = useTrashDeck();
  const [over, setOver] = useState(false);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const deckId = e.dataTransfer.getData(DECK_DRAG_KEY);
    if (!deckId) return;
    try {
      await trash.mutateAsync(deckId);
      message.success("Moved to trash.");
    } catch (err) {
      message.error(isApiError(err) ? err.message : "Couldn't move to trash.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => navigate(paths.trash)}
      onDragOver={(e) => {
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => void onDrop(e)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
        over
          ? "bg-red-50 text-red-600 ring-1 ring-red-300"
          : active
            ? "bg-indigo-50 text-indigo-700"
            : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      <DeleteOutlined className="text-[16px]" />
      Trash
    </button>
  );
}
