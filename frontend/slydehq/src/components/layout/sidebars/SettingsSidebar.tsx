import { Tag } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import {
  activeSettingsSection,
  settingsSections,
} from "@/features/settings/sections";
import SideItem from "../SideItem";

/** Contextual panel for the Settings section: workspace settings sub-nav. */
export default function SettingsSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = activeSettingsSection(location.pathname).key;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 lg:flex">
      <div className="px-3 pb-3 text-[15px] font-semibold text-zinc-900">
        Workspace settings
      </div>
      <nav className="flex flex-col gap-0.5">
        {settingsSections.map((section) => (
          <SideItem
            key={section.key}
            icon={section.icon}
            label={section.label}
            active={section.key === active}
            hint={
              section.pro ? (
                <Tag color="geekblue" className="!m-0 !text-[10px] !leading-4">
                  PRO
                </Tag>
              ) : undefined
            }
            onClick={() => navigate(section.path)}
          />
        ))}
      </nav>
    </aside>
  );
}
