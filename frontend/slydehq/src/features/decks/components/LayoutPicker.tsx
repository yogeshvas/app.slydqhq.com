import { useState } from "react";
import { CheckCircleFilled, DownOutlined } from "@ant-design/icons";
import { Drawer } from "antd";
import { LAYOUT_GROUPS } from "../layouts";
import { LayoutSkeleton } from "./LayoutSkeleton";

const labelFor = (value?: string) => {
  for (const g of LAYOUT_GROUPS) {
    const o = g.options.find((x) => x.value === value);
    if (o) return o.label;
  }
  return value ?? "Choose a layout";
};

interface Props {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Layout control: a trigger button + a bottom drawer of skeleton previews. */
export function LayoutPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex h-[38px] w-full items-center justify-between gap-2 border border-zinc-300 bg-white px-3 text-[14px] text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
      >
        <span className="truncate">{labelFor(value)}</span>
        <DownOutlined className="text-[10px] text-zinc-400" />
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom"
        height="80vh"
        title="Choose a layout"
        classNames={{ wrapper: "!w-full md:!left-1/4 md:!right-auto md:!w-1/2" }}
      >
        <div className="space-y-6 pb-4">
          {LAYOUT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.options.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`overflow-hidden border text-left transition ${
                        active
                          ? "border-indigo-500 ring-2 ring-indigo-200"
                          : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
                      }`}
                    >
                      <LayoutSkeleton layout={opt.value} />
                      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                        <span className="truncate text-[13px] font-medium text-zinc-700">
                          {opt.label}
                        </span>
                        {active && (
                          <CheckCircleFilled className="shrink-0 text-indigo-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </>
  );
}
