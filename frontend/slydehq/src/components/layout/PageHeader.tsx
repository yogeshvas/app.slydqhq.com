import type { ReactNode } from "react";
import { BellOutlined, SearchOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import { useCommandPalette } from "@/features/decks/store/command-palette.store";

interface Props {
  title: ReactNode;
  icon?: ReactNode;
  /** Optional right-aligned extras placed before the shared utilities. */
  extra?: ReactNode;
  /** Hide the credits/search/bell cluster (e.g. focused pages). */
  utilities?: boolean;
}

/** Shared page header: section title on the left, credits + utilities right. */
export default function PageHeader({
  title,
  icon,
  extra,
  utilities = true,
}: Props) {
  const { data: workspace } = useWorkspace();
  const openPalette = useCommandPalette((s) => s.setOpen);
  const navigate = useNavigate();

  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-[20px] text-zinc-700">{icon}</span>}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
      </div>

      {utilities && (
        <div className="flex items-center gap-3">
          {extra}
          <Tooltip title="Credits & billing">
            <button
              type="button"
              onClick={() => navigate("/settings/billing")}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <ThunderboltOutlined className="text-amber-500" />
              {workspace?.credits ?? 0} credits
            </button>
          </Tooltip>
          <Tooltip title="Search decks (⌘K)">
            <Button
              type="text"
              shape="circle"
              icon={<SearchOutlined />}
              onClick={() => openPalette(true)}
            />
          </Tooltip>
          <Button type="text" shape="circle" icon={<BellOutlined />} />
        </div>
      )}
    </div>
  );
}
