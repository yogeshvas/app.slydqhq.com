import { useEffect, useState } from "react";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Breadcrumb,
  Button,
  ColorPicker,
  Input,
  Select,
} from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { isApiError } from "@/lib/api-client";
import { decksApi } from "../api/decks.api";
import { CornerCat } from "../components/CornerCat";
import { ThemePicker } from "../components/ThemeSelect";
import { addRecentPrompt, sampleExamplePrompts } from "../recent-prompts";
import { useGenerationStore } from "../store/generation.store";
import { themePreview } from "../theme-previews";
import {
  ACCENT_OPTIONS,
  CANVAS_OPTIONS,
  CARD_COUNT_OPTIONS,
  DECK_TYPE_CHIPS,
} from "../types/deck.types";

const GRADIENT = "bg-gradient-to-b from-white via-indigo-50 to-sky-100";

const TYPE_ICONS: Record<string, string> = {
  general: "/icons/presentation.svg",
  pitch_deck: "/icons/graphic.svg",
  proposal: "/icons/document.svg",
  social_post: "/icons/social.svg",
  course: "/icons/website.svg",
};

const GeneratePage = () => {
  useDocumentTitle("Generate");
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();

  const config = useGenerationStore((s) => s.config);
  const setConfig = useGenerationStore((s) => s.setConfig);
  const setOutline = useGenerationStore((s) => s.setOutline);

  const [examples, setExamples] = useState(() => sampleExamplePrompts(6));
  const [loading, setLoading] = useState(false);
  const [catVisible, setCatVisible] = useState(true);

  // Seed the prompt from a clicked recent/example prompt (route state), once.
  const seedPrompt = (location.state as { prompt?: string } | null)?.prompt;
  useEffect(() => {
    if (seedPrompt) setConfig({ prompt: seedPrompt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ratioLocked = config.deckType !== "social_post";
  const selectType = (value: string) => {
    setConfig({
      deckType: value,
      ...(value !== "social_post" ? { canvas: "widescreen_16_9" } : {}),
    });
  };

  // Resolve the current accent to a hex + display name (preset name or hex).
  const accentPreset = ACCENT_OPTIONS.find(
    (a) =>
      a.value !== "" &&
      (a.value === config.accentColor || a.hex === config.accentColor),
  );
  const accentHex = config.accentColor.startsWith("#")
    ? config.accentColor
    : (accentPreset?.hex ?? themePreview(config.theme).accent);
  const accentName =
    config.accentColor === ""
      ? "Theme default"
      : (accentPreset?.label ?? config.accentColor);

  // Slide the cat down, then leave.
  const leaveTo = (path: string) => {
    setCatVisible(false);
    // Fallback nav in case the exit animation doesn't fire.
    window.setTimeout(() => navigate(path), 450);
  };

  const onGenerateOutline = async () => {
    if (config.prompt.trim().length < 3) {
      message.error("Describe what you'd like to make.");
      return;
    }
    setLoading(true);
    try {
      const outline = await decksApi.outline({
        prompt: config.prompt,
        noOfSlides: config.noOfSlides,
        deckType: config.deckType,
        theme: config.theme,
        canvas: config.canvas,
        accentColor: config.accentColor || undefined,
        model: config.model,
      });
      setOutline(outline);
      addRecentPrompt(config.prompt);
      message.success("Outline ready — review your slides.");
      navigate(paths.createOutline);
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "Couldn't generate an outline.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative min-h-full ${GRADIENT}`}>
      <div className="flex items-center gap-3 pl-2 pr-8 pt-6">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => leaveTo(paths.create)}
          className="text-zinc-500"
        >
          Back
        </Button>
        <Breadcrumb
          items={[
            { title: <Link to={paths.dashboard}>Home</Link> },
            { title: <Link to={paths.create}>Create</Link> },
            { title: "Generate" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-3xl px-8 pb-10 pt-6">
        <h1 className="text-center text-4xl font-semibold tracking-tight text-zinc-900">
          Generate
        </h1>
        <p className="mt-2 mb-8 text-center text-zinc-500">
          What would you like to create today?
        </p>

        {/* Type chips */}
        <div className="mb-5 flex flex-wrap justify-center gap-3">
          {DECK_TYPE_CHIPS.map((t) => {
            const active = t.value === config.deckType;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => selectType(t.value)}
                className={`group flex w-28 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <img
                  src={TYPE_ICONS[t.value]}
                  alt=""
                  aria-hidden
                  className={`h-9 w-9 object-contain transition duration-200 ${
                    active
                      ? "opacity-100 drop-shadow-[0_0_8px_rgba(79,70,229,0.6)]"
                      : "opacity-60 grayscale group-hover:opacity-80"
                  }`}
                />
                <span className="text-[13px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="mb-1 flex flex-wrap justify-center gap-3">
          <Select
            value={config.noOfSlides}
            onChange={(v) => setConfig({ noOfSlides: v })}
            options={CARD_COUNT_OPTIONS.map((n) => ({ value: n, label: `${n} cards` }))}
            style={{ width: 130 }}
          />
          <ThemePicker
            value={config.theme}
            onChange={(v) => setConfig({ theme: v })}
          />
          <Select
            value={config.canvas}
            onChange={(v) => setConfig({ canvas: v })}
            options={CANVAS_OPTIONS}
            disabled={ratioLocked}
            style={{ width: 180 }}
          />
        </div>

        {/* Accent colour */}
        <div className="mb-1 mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <span className="mr-1 text-[13px] text-zinc-400">Accent</span>
          {ACCENT_OPTIONS.map((a) => {
            const active = config.accentColor === a.value;
            const dot = a.hex ?? themePreview(config.theme).accent;
            return (
              <button
                key={a.value || "default"}
                type="button"
                title={a.label}
                onClick={() => setConfig({ accentColor: a.value })}
                className={`h-6 w-6 rounded-full ring-offset-2 transition ${
                  active ? "ring-2 ring-zinc-800" : "ring-1 ring-black/10 hover:scale-110"
                }`}
                style={{ background: dot }}
              >
                {a.value === "" && (
                  <span className="text-[10px] font-semibold text-white/90">A</span>
                )}
              </button>
            );
          })}

          {/* Custom hex */}
          <ColorPicker
            value={accentHex}
            onChangeComplete={(color) =>
              setConfig({ accentColor: color.toHexString() })
            }
            size="small"
          />
          <span className="text-[12px] text-zinc-500">{accentName}</span>
        </div>

        {/* Prompt */}
        <Input.TextArea
          value={config.prompt}
          onChange={(e) => setConfig({ prompt: e.target.value })}
          placeholder="Describe what you'd like to make"
          autoSize={{ minRows: 3, maxRows: 6 }}
          className="!mt-6 !text-[15px]"
        />

        <div className="mt-6 flex justify-center">
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={onGenerateOutline}
            className="!shadow-[0_0_18px_rgba(79,70,229,0.55)] transition-shadow duration-200 hover:!shadow-[0_0_26px_rgba(79,70,229,0.75)]"
          >
            Generate outline
          </Button>
        </div>

        {/* Example prompts */}
        <div className="mt-12">
          <div className="mb-4 text-center text-zinc-400">Example prompts</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setConfig({ prompt: ex })}
                className="group flex items-start justify-between gap-2 border border-zinc-200 bg-white/70 p-4 text-left text-[13px] text-zinc-700 shadow-sm transition hover:bg-white hover:shadow-md"
              >
                <span className="line-clamp-3">{ex}</span>
                <PlusOutlined className="mt-0.5 shrink-0 text-zinc-300 group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-center">
            <Button
              icon={<SwapOutlined />}
              onClick={() => setExamples(sampleExamplePrompts(6))}
            >
              Shuffle
            </Button>
          </div>
        </div>
      </div>

      <CornerCat
        visible={catVisible}
        onExitComplete={() => navigate(paths.create)}
      />
    </div>
  );
};

export default GeneratePage;
