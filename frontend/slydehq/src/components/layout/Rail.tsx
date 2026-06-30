import { useState } from "react";
import {
  EllipsisOutlined,
  LinkedinFilled,
  LogoutOutlined,
  MailOutlined,
  MessageOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Avatar, Dropdown, Tooltip } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout } from "@/features/auth/hooks/use-auth";
import { useProfile } from "@/features/profile/hooks/use-profile";
import { WorkspaceSwitcher } from "@/features/workspace/components/WorkspaceSwitcher";
import { FeedbackModal } from "@/features/feedback/FeedbackModal";
import { activeSection, railSections } from "./nav";

// ── Contact links surfaced in the "More" menu ──────────────────────────────────
const LINKEDIN_URL = "https://www.linkedin.com/in/yogeshvashisth/";
const DEVELOPER_EMAIL = "writetokhair@gmail.com";

const initials = (value?: string) =>
  value ? value.slice(0, 2).toUpperCase() : "U";

/** The slim icon rail: primary sections + account, always visible. */
export default function Rail() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useProfile();
  const logout = useLogout();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const active = activeSection(location.pathname).key;
  const avatarUrl = profile?.avatar || user?.avatarUrl;
  const displayName = profile?.name || user?.name;

  const onLogout = async () => {
    await logout.mutateAsync();
    navigate(paths.login, { replace: true });
  };

  const moreItems = [
    {
      key: "linkedin",
      icon: <LinkedinFilled />,
      label: "My LinkedIn",
      onClick: () => window.open(LINKEDIN_URL, "_blank", "noopener,noreferrer"),
    },
    {
      key: "developer",
      icon: <MailOutlined />,
      label: "Talk to the developer",
      onClick: () => {
        // Open Gmail's web composer in a new tab — reliable even when the OS has
        // no default mail app registered (where a bare mailto: silently no-ops).
        const subject = encodeURIComponent("Hello from Slyde HQ");
        const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${DEVELOPER_EMAIL}&su=${subject}`;
        const win = window.open(gmail, "_blank", "noopener,noreferrer");
        // Fall back to the mailto: handler if the popup was blocked.
        if (!win) window.location.href = `mailto:${DEVELOPER_EMAIL}?subject=${subject}`;
      },
    },
  ];

  return (
    <aside className="flex w-20 shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-50 py-4">
      <Link to={paths.dashboard} className="mb-3">
        <img src="/logo.png" alt="Slyde HQ" className="h-7 w-7 object-contain" />
      </Link>

      <div className="mb-3">
        <WorkspaceSwitcher />
      </div>

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

        <Dropdown menu={{ items: moreItems }} trigger={["click"]} placement="topLeft">
          <button
            type="button"
            className="flex w-full flex-col items-center gap-1 py-1"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg text-[18px] text-zinc-600 hover:bg-zinc-200/70">
              <EllipsisOutlined />
            </span>
            <span className="text-[11px] leading-none text-zinc-500">More</span>
          </button>
        </Dropdown>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4 pt-4">
        <Tooltip title="Invite teammates" placement="right">
          <button
            type="button"
            onClick={() => navigate(paths.members)}
            className="text-[18px] text-zinc-500 hover:text-zinc-800"
          >
            <UsergroupAddOutlined />
          </button>
        </Tooltip>
        <Tooltip title="Support & feedback" placement="right">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="text-[18px] text-zinc-500 hover:text-zinc-800"
          >
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
            src={avatarUrl}
            className="cursor-pointer bg-amber-400 align-middle text-zinc-900"
          >
            {initials(displayName)}
          </Avatar>
        </Dropdown>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </aside>
  );
}
