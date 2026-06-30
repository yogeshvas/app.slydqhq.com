import { useState } from "react";
import { BgColorsOutlined, CheckCircleFilled, DownOutlined } from "@ant-design/icons";
import { Drawer } from "antd";
import { THEME_PREVIEWS, themePreview } from "../theme-previews";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Compact theme control: looks like a dropdown, but opens a modal that renders
 * a real sample slide for each theme so users can see how visuals will look.
 */
export function ThemePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = themePreview(value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[38px] min-w-[150px] items-center justify-between gap-2 rounded-full border border-zinc-300 bg-white px-4 text-[14px] text-zinc-800 transition hover:border-zinc-400"
      >
        <span className="flex items-center gap-2">
          <BgColorsOutlined className="text-[14px] text-zinc-400" />
          {current.label}
        </span>
        <DownOutlined className="text-[10px] text-zinc-400" />
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom"
        height="auto"
        title="Choose a theme"
        classNames={{ wrapper: "!w-full md:!left-1/4 md:!right-auto md:!w-1/2" }}
      >
        <div className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2">
          {THEME_PREVIEWS.map((t) => {
            const active = t.value === value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  onChange(t.value);
                  setOpen(false);
                }}
                className={`overflow-hidden border text-left transition ${
                  active
                    ? "border-indigo-500 ring-2 ring-indigo-200"
                    : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
                }`}
              >
                <img
                  src={t.image}
                  alt={`${t.label} theme sample slide`}
                  className="aspect-video w-full bg-zinc-50 object-cover"
                  loading="lazy"
                />
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900">{t.label}</div>
                    <div className="truncate text-[12px] text-zinc-500">
                      {t.description}
                    </div>
                  </div>
                  {active && (
                    <CheckCircleFilled className="shrink-0 text-[18px] text-indigo-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Drawer>
    </>
  );
}
