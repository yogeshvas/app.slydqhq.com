import { useEffect, useState } from "react";
import { Modal, Select, Tag, Typography } from "antd";
import type { MediaItem } from "../types";

const { Text } = Typography;

interface Props {
  item: MediaItem | null;
  saving: boolean;
  onSave: (id: string, tags: string[]) => void;
  onClose: () => void;
}

/** Edit an item's user tags. AI-suggested tags are shown for quick adding. */
export function MediaTagsModal({ item, saving, onSave, onClose }: Props) {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    setTags(item?.tags ?? []);
  }, [item?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      open={Boolean(item)}
      title="Edit tags"
      okText="Save tags"
      confirmLoading={saving}
      onOk={() => item && onSave(item._id, tags)}
      onCancel={onClose}
      destroyOnClose
    >
      {item && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <img
              src={item.url}
              alt=""
              className="h-20 w-28 shrink-0 border border-zinc-200 object-cover"
            />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-zinc-800">
                {item.title || item.originalFilename || "Untitled"}
              </div>
              {item.description && (
                <Text type="secondary" className="!text-[12px]">
                  {item.description}
                </Text>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[12px] font-medium text-zinc-500">Your tags</div>
            <Select
              mode="tags"
              value={tags}
              onChange={setTags}
              className="w-full"
              placeholder="Add tags to make this easy to find"
              tokenSeparators={[","]}
            />
          </div>

          {item.aiTags.length > 0 && (
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-500">
                AI-suggested (click to add)
              </div>
              <div className="flex flex-wrap gap-1">
                {item.aiTags.map((t) => (
                  <Tag
                    key={t}
                    className="cursor-pointer"
                    onClick={() =>
                      setTags((cur) => (cur.includes(t) ? cur : [...cur, t]))
                    }
                  >
                    {t}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
