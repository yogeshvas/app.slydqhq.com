import { useEffect, useState } from "react";
import {
  CheckCircleFilled,
  CloseOutlined,
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, Divider, Input, Segmented, Spin, Typography } from "antd";
import { LayoutPicker } from "./LayoutPicker";
import { IMAGE_LAYOUTS } from "../layouts";
import type { Slide, SlideContent } from "../types/deck.types";

const { Text } = Typography;

interface Props {
  slide: Slide;
  saving: boolean;
  /** Which tab is shown — controlled by the right-edge tool rail. */
  tab: "ai" | "content";
  /** User switched tabs from the inspector's own segmented control. */
  onTabChange: (tab: "ai" | "content") => void;
  /** Collapse the inspector back to the icon rail. */
  onClose: () => void;
  /** Persist edited structured content (re-renders server-side). */
  onApply: (content: SlideContent) => void;
  /** Apply all pending AI changes at once (instruction + layout + image). */
  onApplyAi: (args: {
    instruction?: string;
    layout?: string;
    imagePrompt?: string;
    imageSource?: "ai" | "unsplash";
    imageUrl?: string;
  }) => Promise<boolean>;
  /** Search stock photos for the picker — returns several URLs. */
  onSearchStock: (query: string) => Promise<string[]>;
}

export function SlideInspector({
  slide,
  saving,
  tab,
  onTabChange,
  onClose,
  onApply,
  onApplyAi,
  onSearchStock,
}: Props) {
  // Manual content fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);

  // AI fields
  const [instruction, setInstruction] = useState("");
  const [layout, setLayout] = useState<string | undefined>(undefined);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSource, setImageSource] = useState<"ai" | "unsplash">("ai");
  // Stock-photo picker
  const [stockResults, setStockResults] = useState<string[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [chosenUrl, setChosenUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const c = (slide.content ?? {}) as SlideContent;
    setTitle((c.title as string) ?? slide.title ?? "");
    setDescription((c.description as string) ?? "");
    setBullets(Array.isArray(c.bulletPoints) ? (c.bulletPoints as string[]) : []);
    setInstruction("");
    setLayout(slide.layout);
    setImagePrompt("");
    setStockResults([]);
    setChosenUrl(undefined);
    setStockLoading(false);
  }, [slide._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = slide.content;
  const hasStructured = Boolean(
    c &&
      typeof c === "object" &&
      (c.title != null || c.description != null || c.bulletPoints != null),
  );
  const base = (slide.content ?? {}) as SlideContent;

  const layoutChanged = Boolean(layout && layout !== slide.layout);

  // Image layouts (hero / image_left / image_right / quote_image) need an image to
  // look right. If the chosen layout needs one and the slide has none, an image
  // prompt is compulsory before applying — otherwise you get an empty image panel.
  const effectiveLayout = layout ?? slide.layout;
  const layoutNeedsImage = IMAGE_LAYOUTS.has(effectiveLayout ?? "");
  const slideHasImage = Boolean(base.imageUrl || base.aiImage);
  // AI source → a prompt is enough; Stock source → the user must pick a result.
  const imageProvided =
    imageSource === "ai" ? imagePrompt.trim().length > 0 : Boolean(chosenUrl);
  const imageRequired = layoutNeedsImage && !slideHasImage;
  const imageMissing = imageRequired && !imageProvided;

  const aiPending =
    (hasStructured && (instruction.trim().length > 0 || layoutChanged)) ||
    imageProvided;
  const canApplyAi = aiPending && !imageMissing;

  const applyManual = () =>
    onApply({
      ...base,
      title,
      description,
      bulletPoints: bullets.map((b) => b.trim()).filter(Boolean),
    });

  const runStockSearch = async () => {
    if (!imagePrompt.trim()) return;
    setStockLoading(true);
    setChosenUrl(undefined);
    try {
      setStockResults(await onSearchStock(imagePrompt.trim()));
    } finally {
      setStockLoading(false);
    }
  };

  const applyAi = async () => {
    const imageArgs = imageProvided
      ? imageSource === "unsplash"
        ? { imageUrl: chosenUrl }
        : { imagePrompt: imagePrompt.trim(), imageSource: "ai" as const }
      : {};
    const ok = await onApplyAi({
      instruction:
        hasStructured && instruction.trim() ? instruction.trim() : undefined,
      layout: hasStructured && layoutChanged ? layout : undefined,
      ...imageArgs,
    });
    if (ok) {
      setInstruction("");
      setImagePrompt("");
      setStockResults([]);
      setChosenUrl(undefined);
    }
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <span className="text-[13px] font-semibold text-zinc-700">Edit slide</span>
        <div className="flex items-center gap-1">
          {saving && <Spin size="small" />}
          <Button
            type="text"
            size="small"
            aria-label="Close panel"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="!text-zinc-400 hover:!text-zinc-700"
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <Segmented
          block
          value={tab}
          onChange={(v) => onTabChange(v as "ai" | "content")}
          options={[
            { label: "Ask AI", value: "ai" },
            { label: "Content", value: "content" },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {!hasStructured && (
          <Text type="secondary" className="block text-[12px]">
            This slide has no structured content (older deck), so AI edits and
            layout changes aren't available. You can still edit text on the slide.
          </Text>
        )}

        {tab === "ai" ? (
          <>
            {/* AI instruction */}
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-500">
                Tell AI what to change
              </div>
              <Input.TextArea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                autoSize={{ minRows: 3, maxRows: 6 }}
                placeholder="e.g. Make the tone more formal and shorten the bullets"
                disabled={!hasStructured}
              />
            </div>

            <Divider className="!my-1" />

            {/* Layout */}
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-500">Layout</div>
              <LayoutPicker
                value={layout}
                onChange={setLayout}
                disabled={!hasStructured}
              />
              <Text type="secondary" className="mt-1 block text-[11px]">
                {layoutChanged
                  ? "AI will re-fit the content to this layout."
                  : "AI re-fits the existing content to the new layout."}
              </Text>
            </div>

            <Divider className="!my-1" />

            {/* Image */}
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-500">
                <PictureOutlined /> Image
                {imageRequired && (
                  <span className="font-semibold text-amber-600">· Required</span>
                )}
              </div>
              <Input.TextArea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 4 }}
                status={imageMissing ? "warning" : undefined}
                placeholder="Describe the image, e.g. a team collaborating around a laptop"
              />
              <Segmented
                size="small"
                className="!mt-2"
                value={imageSource}
                onChange={(v) => {
                  setImageSource(v as "ai" | "unsplash");
                  setChosenUrl(undefined);
                }}
                options={[
                  { label: "AI image", value: "ai" },
                  { label: "Stock photo", value: "unsplash" },
                ]}
              />

              {/* Stock photo picker — search, then choose from the results. */}
              {imageSource === "unsplash" && (
                <div className="mt-2">
                  <Button
                    block
                    size="small"
                    icon={<PictureOutlined />}
                    loading={stockLoading}
                    disabled={!imagePrompt.trim()}
                    onClick={runStockSearch}
                  >
                    Find photos
                  </Button>
                  {stockResults.length > 0 && (
                    <>
                      <Text className="mt-2 mb-1 block text-[11px] !text-zinc-400">
                        Pick one:
                      </Text>
                      <div className="grid grid-cols-3 gap-1.5">
                        {stockResults.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setChosenUrl(url)}
                            className={`relative aspect-[4/3] overflow-hidden border transition ${
                              chosenUrl === url
                                ? "border-indigo-500 ring-2 ring-indigo-200"
                                : "border-zinc-200 hover:border-zinc-300"
                            }`}
                          >
                            <img
                              src={url}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            {chosenUrl === url && (
                              <span className="absolute right-0.5 top-0.5 text-indigo-500">
                                <CheckCircleFilled />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {stockResults.length === 0 &&
                    !stockLoading &&
                    imagePrompt.trim() && (
                      <Text className="mt-1 block text-[11px] !text-zinc-400">
                        Tap “Find photos” to see options.
                      </Text>
                    )}
                </div>
              )}

              {imageMissing && (
                <Text className="mt-1.5 block text-[11px] !text-amber-600">
                  {imageSource === "unsplash"
                    ? "This layout shows an image — search and pick one to apply."
                    : "This layout shows an image — describe one to apply."}
                </Text>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Manual content */}
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-500">Title</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-500">
                Description
              </div>
              <Input.TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 5 }}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12px] font-medium text-zinc-500">
                  Bullet points
                </span>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setBullets((b) => [...b, ""])}
                  className="!px-0"
                >
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={b}
                      onChange={(e) =>
                        setBullets((arr) =>
                          arr.map((x, j) => (j === i ? e.target.value : x)),
                        )
                      }
                      placeholder="Bullet text"
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        setBullets((arr) => arr.filter((_, j) => j !== i))
                      }
                    />
                  </div>
                ))}
                {bullets.length === 0 && (
                  <Text type="secondary" className="text-[12px]">
                    No bullet points.
                  </Text>
                )}
              </div>
            </div>
            <Button
              type="primary"
              block
              loading={saving}
              disabled={!hasStructured}
              onClick={applyManual}
            >
              Apply changes
            </Button>
          </>
        )}
      </div>

      {/* One button applies the instruction, layout, and image together. */}
      {tab === "ai" && (
        <div className="border-t border-zinc-100 p-4">
          <Button
            type="primary"
            block
            size="large"
            icon={<ThunderboltOutlined />}
            loading={saving}
            disabled={!canApplyAi}
            onClick={applyAi}
          >
            Apply with AI
          </Button>
          <Text
            className={`mt-1.5 block text-center text-[11px] ${
              imageMissing ? "!text-amber-600" : "!text-zinc-400"
            }`}
          >
            {imageMissing
              ? "This layout needs an image — describe one above."
              : "Applies your instruction, layout & image together."}
          </Text>
        </div>
      )}
    </aside>
  );
}
