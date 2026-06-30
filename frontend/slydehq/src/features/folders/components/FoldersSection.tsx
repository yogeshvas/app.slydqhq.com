import { useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  FolderFilled,
  FolderOpenOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { App as AntApp, Dropdown, Input, Modal } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import {
  useCreateFolder,
  useDeleteFolder,
  useFolders,
  useMoveDeck,
  useUpdateFolder,
} from "../hooks/use-folders";
import type { Folder } from "../api/folders.api";

/** The DnD payload key deck cards set on dragstart. */
export const DECK_DRAG_KEY = "application/x-slyde-deck";

/**
 * Sidebar "Folders" section: list folders (with deck counts), create new, rename,
 * delete, and accept deck cards dropped onto a folder (drag-and-drop filing).
 */
export function FoldersSection() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const activeFolder = params.get("folder");

  const { data: folders = [], isLoading } = useFolders();
  const create = useCreateFolder();
  const update = useUpdateFolder();
  const remove = useDeleteFolder();
  const move = useMoveDeck();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<Folder | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const openFolder = (id: string) => navigate(`${paths.dashboard}?folder=${id}`);

  const doCreate = async () => {
    if (!newName.trim()) return;
    try {
      const f = await create.mutateAsync({ name: newName.trim() });
      setCreating(false);
      setNewName("");
      message.success("Folder created.");
      openFolder(f._id);
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't create folder.");
    }
  };

  const doRename = async () => {
    if (!renaming || !renameVal.trim()) return;
    try {
      await update.mutateAsync({ id: renaming._id, patch: { name: renameVal.trim() } });
      setRenaming(null);
      message.success("Folder renamed.");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Couldn't rename.");
    }
  };

  const doDelete = (f: Folder) => {
    Modal.confirm({
      title: `Delete “${f.name}”?`,
      content: "The folder is removed. Its decks are kept and become unfiled.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove.mutateAsync(f._id);
          if (activeFolder === f._id) navigate(paths.dashboard);
          message.success("Folder deleted.");
        } catch (e) {
          message.error(isApiError(e) ? e.message : "Couldn't delete.");
        }
      },
    });
  };

  const onDropDeck = async (folderId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const deckId = e.dataTransfer.getData(DECK_DRAG_KEY);
    if (!deckId) return;
    try {
      await move.mutateAsync({ deckId, folderId });
      message.success("Moved to folder.");
    } catch (err) {
      message.error(isApiError(err) ? err.message : "Couldn't move deck.");
    }
  };

  const menu = (f: Folder): MenuProps["items"] => [
    {
      key: "rename",
      icon: <EditOutlined />,
      label: "Rename",
      onClick: () => {
        setRenaming(f);
        setRenameVal(f.name);
      },
    },
    {
      key: "delete",
      icon: <DeleteOutlined />,
      label: "Delete",
      danger: true,
      onClick: () => doDelete(f),
    },
  ];

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Folders
        </span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-zinc-400 transition-colors hover:text-indigo-600"
          title="New folder"
        >
          <PlusOutlined />
        </button>
      </div>

      {folders.length === 0 && !isLoading ? (
        <div className="rounded-lg bg-zinc-50 px-4 py-4 text-center">
          <p className="text-[13px] leading-relaxed text-zinc-500">
            Organize your decks by topic and share them with your team.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
          >
            Create a folder
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {folders.map((f) => (
            <Dropdown key={f._id} trigger={["contextMenu"]} menu={{ items: menu(f) }}>
              <button
                type="button"
                onClick={() => openFolder(f._id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dropTarget !== f._id) setDropTarget(f._id);
                }}
                onDragLeave={() => setDropTarget((t) => (t === f._id ? null : t))}
                onDrop={(e) => void onDropDeck(f._id, e)}
                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                  dropTarget === f._id
                    ? "bg-indigo-100 ring-1 ring-indigo-300"
                    : activeFolder === f._id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {activeFolder === f._id ? (
                  <FolderOpenOutlined style={{ color: f.color }} />
                ) : (
                  <FolderFilled style={{ color: f.color }} />
                )}
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-[12px] text-zinc-400">{f.deckCount}</span>
                <Dropdown trigger={["click"]} menu={{ items: menu(f) }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden text-zinc-400 hover:text-zinc-700 group-hover:inline"
                  >
                    ⋯
                  </span>
                </Dropdown>
              </button>
            </Dropdown>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={creating}
        title="New folder"
        okText="Create"
        confirmLoading={create.isPending}
        onOk={() => void doCreate()}
        onCancel={() => setCreating(false)}
        destroyOnClose
      >
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={() => void doCreate()}
          placeholder="e.g. Client proposals"
          maxLength={80}
        />
      </Modal>

      {/* Rename modal */}
      <Modal
        open={Boolean(renaming)}
        title="Rename folder"
        okText="Save"
        confirmLoading={update.isPending}
        onOk={() => void doRename()}
        onCancel={() => setRenaming(null)}
        destroyOnClose
      >
        <Input
          autoFocus
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onPressEnter={() => void doRename()}
          maxLength={80}
        />
      </Modal>
    </div>
  );
}
