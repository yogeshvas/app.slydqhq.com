import { CheckOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { App as AntApp, Avatar, Dropdown, Tag, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import {
  useSwitchWorkspace,
  useWorkspace,
  useWorkspaceList,
} from "../hooks/use-workspace";

const initial = (name?: string) => (name ? name[0]!.toUpperCase() : "W");

/**
 * Compact workspace switcher for the icon rail: shows the active workspace's
 * badge and opens a menu of every workspace the user belongs to.
 */
export function WorkspaceSwitcher() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const { data: current } = useWorkspace();
  const { data: list } = useWorkspaceList();
  const switchWs = useSwitchWorkspace();

  const onSwitch = async (id: string) => {
    if (id === current?.id) return;
    try {
      const ws = await switchWs.mutateAsync(id);
      message.success(`Switched to ${ws.name}.`);
      navigate(paths.dashboard);
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "Couldn't switch workspace.",
      );
    }
  };

  const workspaces = list ?? [];

  const items: MenuProps["items"] = [
    {
      key: "label",
      type: "group",
      label: "Workspaces",
      children: workspaces.map((w) => ({
        key: w.id,
        onClick: () => onSwitch(w.id),
        label: (
          <div className="flex items-center gap-2 py-0.5">
            <Avatar size={22} src={w.avatar || undefined} className="bg-indigo-500 text-[11px]">
              {initial(w.name)}
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium">{w.name}</span>
                {w.plan === "pro" && (
                  <Tag color="geekblue" className="!m-0 !px-1 !text-[10px] !leading-4">
                    PRO
                  </Tag>
                )}
              </div>
              <div className="text-[11px] text-zinc-400">
                {w.isOwn ? "Your workspace" : `${w.role} · ${w.credits} credits`}
              </div>
            </div>
            {w.isActive && <CheckOutlined className="text-indigo-600" />}
          </div>
        ),
      })),
    },
    { type: "divider" },
    {
      key: "members",
      icon: <PlusOutlined />,
      label: "Invite teammates",
      onClick: () => navigate(paths.members),
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Workspace settings",
      onClick: () => navigate(paths.settings),
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      trigger={["click"]}
      placement="bottomLeft"
      overlayStyle={{ minWidth: 240 }}
    >
      <Tooltip title={current?.name ?? "Workspace"} placement="right">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-[15px] font-semibold text-white transition-transform hover:scale-105"
        >
          {initial(current?.name)}
        </button>
      </Tooltip>
    </Dropdown>
  );
}
