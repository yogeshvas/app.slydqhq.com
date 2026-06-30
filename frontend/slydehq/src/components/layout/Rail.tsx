import {
  EllipsisOutlined,
  LogoutOutlined,
  MessageOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Avatar, Dropdown, Tooltip } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout } from "@/features/auth/hooks/use-auth";
import { activeSection, railSections } from "./nav";

const initials = (value?: string) =>
  value ? value.slice(0, 2).toUpperCase() : "U";

/** The slim icon rail: primary sections + account, always visible. */
export default function Rail() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const active = activeSection(location.pathname).key;

  const onLogout = async () => {
    await logout.mutateAsync();
    navigate(paths.login, { replace: true });
  };

  return (
    <aside className="flex w-20 shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-50 py-4">
      <Link to={paths.dashboard} className="mb-4">
        <img src="/logo.png" alt="Slyde HQ" className="h-7 w-7 object-contain" />
      </Link>

      <nav className="flex w-full flex-col items-center gap-1">
        {railSections.map((section) => {
          const isActive = section.key === active;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => navigate(section.path)}
              className="flex w-full flex-col items-center gap-1 py-1"
            >
              <span
                className={[
                  "grid h-9 w-9 place-items-center rounded-lg text-[18px] transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-zinc-600 hover:bg-zinc-200/70",
                ].join(" ")}
              >
                {section.icon}
              </span>
              <span
                className={[
                  "text-[11px] leading-none",
                  isActive ? "font-medium text-zinc-900" : "text-zinc-500",
                ].join(" ")}
              >
                {section.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="flex w-full flex-col items-center gap-1 py-1"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg text-[18px] text-zinc-600 hover:bg-zinc-200/70">
            <EllipsisOutlined />
          </span>
          <span className="text-[11px] leading-none text-zinc-500">More</span>
        </button>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4 pt-4">
        <Tooltip title="Invite teammates" placement="right">
          <button type="button" className="text-[18px] text-zinc-500 hover:text-zinc-800">
            <UsergroupAddOutlined />
          </button>
        </Tooltip>
        <Tooltip title="Support & feedback" placement="right">
          <button type="button" className="text-[18px] text-zinc-500 hover:text-zinc-800">
            <MessageOutlined />
          </button>
        </Tooltip>

        <Dropdown
          trigger={["click"]}
          placement="topRight"
          menu={{
            items: [
              {
                key: "logout",
                icon: <LogoutOutlined />,
                label: "Sign out",
                onClick: onLogout,
              },
            ],
          }}
        >
          <Avatar
            src={user?.avatarUrl}
            className="cursor-pointer bg-amber-400 align-middle text-zinc-900"
          >
            {initials(user?.name)}
          </Avatar>
        </Dropdown>
      </div>
    </aside>
  );
}
