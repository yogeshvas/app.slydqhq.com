import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Breadcrumb,
  Button,
  Card,
  Input,
  Progress,
  Select,
  Spin,
  Tag,
  Typography,
} from "antd";
import { motion, Reorder, useDragControls } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { deckPath, paths } from "@/routes/paths";
import { isApiError } from "@/lib/api-client";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import { decksApi } from "../api/decks.api";
import { CornerGuide } from "../components/CornerGuide";
import { SlideFrame } from "../components/SlideFrame";
import { SlideSkeleton } from "../components/SlideSkeleton";
import { ThemePicker } from "../components/ThemeSelect";
import { useDeckGeneration } from "../hooks/use-deck-generation";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useGenerationStore } from "../store/generation.store";
import {
  CANVAS_OPTIONS,
  CARD_COUNT_OPTIONS,
  MODEL_OPTIONS,
  type DeckOutline,
  type OutlineSlide,
} from "../types/deck.types";

const { Title, Text } = Typography;
const GRADIENT = "bg-gradient-to-b from-white via-indigo-50 to-sky-100";

/** An animated gradient frame — wraps the AI model picker so it reads as "magic". */
function ShimmerBorder({ children }: { children: ReactNode }) {
  return (
    <div className="relative inline-flex">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[1.5px] z-0"
        style={{
          background:
            "linear-gradient(110deg, #6366f1, #a855f7, #22d3ee, #ec4899, #6366f1)",
          backgroundSize: "300% 100%",
        }}
        animate={{ backgroundPositionX: ["0%", "-300%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative z-10 bg-white">{children}</div>
    </div>
  );
}

/** Small inline sparkle mark — reads as "AI / magic". */
function Sparkles({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2l1.7 4.8 4.8 1.7-4.8 1.7L12 15l-1.7-4.8L5.5 8.5l4.8-1.7L12 2z" />
      <path d="M18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" opacity=".7" />
    </svg>
  );
}

// ── A single draggable outline card. Drag is restricted to the handle so the
//    title/bullet inputs stay editable. Memoized so typing in one card doesn't
//    re-render the others (keeps dragging smooth). ───────────────────────────────
interface CardProps {
  slide: OutlineSlide;
  index: number;
  busy: boolean;
  onTitle: (id: number, value: string) => void;
  onBullet: (id: number, bi: number, value: string) => void;
  onAddBullet: (id: number) => void;
  onRemoveBullet: (id: number, bi: number) => void;
  onRemove: (id: number) => void;
  onAiFill: (id: number, hint?: string) => void;
}

const OutlineCard = memo(function OutlineCard({
  slide,
  index,
  busy,
  onTitle,
  onBullet,
  onAddBullet,
  onRemoveBullet,
  onRemove,
  onAiFill,
}: CardProps) {
  const controls = useDragControls();
  const id = slide.slideNumber;
  const empty = !slide.title.trim() && slide.bullets.length === 0;
  const [hintOpen, setHintOpen] = useState(false);
  const [hint, setHint] = useState("");

  const runAi = () => {
    onAiFill(id, hint.trim() || undefined);
    setHintOpen(false);
    setHint("");
  };

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group relative flex gap-2.5 border border-zinc-200 bg-white shadow-sm transition-colors hover:border-indigo-200"
    >
      {/* Magical generating state */}
      {busy && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-px z-0"
            animate={{
              boxShadow: [
                "0 0 0px rgba(99,102,241,0)",
                "0 0 22px 2px rgba(99,102,241,0.55)",
                "0 0 0px rgba(99,102,241,0)",
              ],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 -left-1/3 w-1/3"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(99,102,241,0.22), transparent)",
              }}
              animate={{ x: ["0%", "420%"] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="absolute inset-0 z-20 grid place-items-center">
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 border border-indigo-100 bg-white/90 px-3 py-1.5 text-[13px] font-medium text-indigo-600 shadow-sm backdrop-blur"
            >
              <Sparkles className="animate-pulse text-indigo-500" />
              Writing this slide…
            </motion.span>
          </div>
        </>
      )}

      {/* Number + drag handle column */}
      <div className="flex w-9 flex-col items-center gap-1.5 border-r border-zinc-100 bg-zinc-50/70 py-2.5">
        <span className="text-[13px] font-semibold text-indigo-500">{index + 1}</span>
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab text-zinc-300 transition hover:text-zinc-500 active:cursor-grabbing"
        >
          <HolderOutlined />
        </button>
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 py-2 pr-2 ${busy ? "opacity-40" : ""}`}>
        <Input
          variant="borderless"
          value={slide.title}
          onChange={(e) => onTitle(id, e.target.value)}
          placeholder="Slide title"
          readOnly={busy}
          className="!px-0 !text-[15px] !font-semibold !text-zinc-900"
        />
        {slide.bullets.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {slide.bullets.map((b, bi) => (
              <div key={bi} className="group/b flex items-center gap-2">
                <span className="text-zinc-300">•</span>
                <Input
                  variant="borderless"
                  value={b}
                  onChange={(e) => onBullet(id, bi, e.target.value)}
                  placeholder="Bullet point"
                  readOnly={busy}
                  className="!px-0 !text-[13px] !text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => onRemoveBullet(id, bi)}
                  className="text-zinc-300 opacity-0 transition group-hover/b:opacity-100 hover:text-red-500"
                >
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-0.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHintOpen((v) => !v)}
            disabled={busy}
            className={`flex items-center gap-1.5 text-[12.5px] font-medium transition disabled:opacity-50 ${
              hintOpen ? "text-indigo-700" : "text-indigo-500 hover:text-indigo-700"
            }`}
          >
            <Sparkles />
            {empty ? "Generate with AI" : "Rewrite with AI"}
          </button>
          <span className="text-zinc-200">·</span>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => onAddBullet(id)}
            disabled={busy}
            className="!h-auto !px-0 !text-[12.5px] !text-zinc-400"
          >
            Add point
          </Button>
        </div>

        {/* Optional AI brief — type what this slide should cover, or leave blank. */}
        {hintOpen && !busy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2 border border-indigo-100 bg-indigo-50/50 p-2"
          >
            <Input.TextArea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Optional: tell the AI what this slide should cover…"
              autoSize={{ minRows: 1, maxRows: 3 }}
              autoFocus
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  runAi();
                }
              }}
              className="!text-[13px]"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                size="small"
                type="text"
                onClick={() => {
                  setHintOpen(false);
                  setHint("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<Sparkles />}
                onClick={runAi}
              >
                {hint.trim() ? "Generate" : "Generate anyway"}
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Delete card */}
      <button
        type="button"
        aria-label="Delete slide"
        onClick={() => onRemove(id)}
        className="self-start p-2 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
      >
        <DeleteOutlined />
      </button>
    </Reorder.Item>
  );
});

const OutlineReviewPage = () => {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { data: workspace } = useWorkspace();
  const { state, run } = useDeckGeneration();
  useDocumentTitle(state.status === "done" ? "Deck ready" : "Outline");

  const config = useGenerationStore((s) => s.config);
  const setConfig = useGenerationStore((s) => s.setConfig);
  const outline = useGenerationStore((s) => s.outline);
  const setOutline = useGenerationStore((s) => s.setOutline);

  const [regenerating, setRegenerating] = useState(false);
  const [hydrating, setHydrating] = useState(!outline);
  const [aiBusy, setAiBusy] = useState<number[]>([]);
  const hydrateOnce = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Toast on generation completion / failure (fires once per status transition).
  const notifiedStatus = useRef<string>("");
  useEffect(() => {
    if (state.status === notifiedStatus.current) return;
    notifiedStatus.current = state.status;
    if (state.status === "done") {
      message.success("🎉 Your deck is ready!");
    } else if (state.status === "error") {
      message.error(state.error ?? "Generation failed. Please try again.");
    }
  }, [state.status, state.error, message]);

  // No outline in the store (deep link / reload after clear) → try restoring the
  // last saved outline from the backend before sending the user back. Saves tokens.
  useEffect(() => {
    if (outline || hydrateOnce.current) return;
    hydrateOnce.current = true;
    void (async () => {
      try {
        const latest = await decksApi.latestOutline();
        if (latest) {
          setConfig({
            prompt: latest.config.prompt,
            deckType: latest.config.deckType,
            theme: latest.config.theme,
            canvas: latest.config.canvas,
            accentColor: latest.config.accentColor,
            model: latest.config.model,
            noOfSlides: latest.config.noOfSlides,
          });
          setOutline({
            deckTitle: latest.deckTitle,
            storyTheme: latest.storyTheme,
            analysis: latest.analysis,
            outlineId: latest.outlineId,
            slides: latest.slides,
          });
        } else {
          navigate(paths.createGenerate, { replace: true });
        }
      } catch {
        navigate(paths.createGenerate, { replace: true });
      } finally {
        setHydrating(false);
      }
    })();
  }, [outline, navigate, setConfig, setOutline]);

  // ── Persistence: save outline edits to the backend so they survive reloads. ──
  const persist = useCallback(() => {
    const o = useGenerationStore.getState().outline;
    if (!o?.outlineId) return;
    void decksApi
      .updateOutline(o.outlineId, { deckTitle: o.deckTitle, slides: o.slides })
      .catch(() => {
        /* best-effort; local store already persists to sessionStorage */
      });
  }, []);
  const schedulePersist = useCallback(() => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(persist, 1200);
  }, [persist]);

  // ── Editing helpers — keyed by stable slideNumber id, store-driven so the
  //    callbacks stay referentially stable (memoized cards + smooth drag). ──
  const update = useCallback((fn: (o: DeckOutline) => DeckOutline) => {
    const o = useGenerationStore.getState().outline;
    if (!o) return;
    useGenerationStore.getState().setOutline(fn(o));
  }, []);

  const editTitle = useCallback(
    (id: number, value: string) => {
      update((o) => ({
        ...o,
        slides: o.slides.map((s) =>
          s.slideNumber === id ? { ...s, title: value } : s,
        ),
      }));
      schedulePersist();
    },
    [update, schedulePersist],
  );
  const editBullet = useCallback(
    (id: number, bi: number, value: string) => {
      update((o) => ({
        ...o,
        slides: o.slides.map((s) =>
          s.slideNumber === id
            ? { ...s, bullets: s.bullets.map((b, j) => (j === bi ? value : b)) }
            : s,
        ),
      }));
      schedulePersist();
    },
    [update, schedulePersist],
  );
  const addBullet = useCallback(
    (id: number) => {
      update((o) => ({
        ...o,
        slides: o.slides.map((s) =>
          s.slideNumber === id ? { ...s, bullets: [...s.bullets, ""] } : s,
        ),
      }));
    },
    [update],
  );
  const removeBullet = useCallback(
    (id: number, bi: number) => {
      update((o) => ({
        ...o,
        slides: o.slides.map((s) =>
          s.slideNumber === id
            ? { ...s, bullets: s.bullets.filter((_, j) => j !== bi) }
            : s,
        ),
      }));
      schedulePersist();
    },
    [update, schedulePersist],
  );
  const removeSlide = useCallback(
    (id: number) => {
      update((o) => ({
        ...o,
        slides: o.slides.filter((s) => s.slideNumber !== id),
      }));
      const len = useGenerationStore.getState().outline?.slides.length ?? 0;
      useGenerationStore.getState().setConfig({ noOfSlides: Math.max(1, len) });
      persist();
    },
    [update, persist],
  );

  const nextId = (slides: OutlineSlide[]) =>
    slides.reduce((m, s) => Math.max(m, s.slideNumber), 0) + 1;

  const addSlide = useCallback(() => {
    update((o) => {
      const slides = [
        ...o.slides,
        { slideNumber: nextId(o.slides), title: "", bullets: [] },
      ];
      useGenerationStore.getState().setConfig({ noOfSlides: slides.length });
      return { ...o, slides };
    });
    persist();
  }, [update, persist]);

  // Card-count dropdown: add blanks / trim from the end to match, keeping edits.
  const changeCardCount = useCallback(
    (n: number) => {
      setConfig({ noOfSlides: n });
      update((o) => {
        const slides = [...o.slides];
        if (n < slides.length) return { ...o, slides: slides.slice(0, n) };
        let next = nextId(slides);
        while (slides.length < n) {
          slides.push({ slideNumber: next++, title: "", bullets: [] });
        }
        return { ...o, slides };
      });
      persist();
    },
    [setConfig, update, persist],
  );

  // Reorder via drag — values are stable slideNumber ids; reorder the slides to match.
  const onReorder = useCallback(
    (order: number[]) => {
      update((o) => {
        const byId = new Map(o.slides.map((s) => [s.slideNumber, s]));
        const slides = order
          .map((n) => byId.get(n))
          .filter((s): s is OutlineSlide => Boolean(s));
        return { ...o, slides };
      });
      persist();
    },
    [update, persist],
  );

  // Per-card AI generation. `hint` is an optional brief for what the slide covers.
  const aiFill = useCallback(
    async (id: number, hint?: string) => {
      const st = useGenerationStore.getState();
      const o = st.outline;
      if (!o) return;
      setAiBusy((prev) => (prev.includes(id) ? prev : [...prev, id]));
      try {
        const pos = o.slides.findIndex((s) => s.slideNumber === id);
        const card = await decksApi.outlineCard({
          prompt: st.config.prompt || o.storyTheme || o.deckTitle,
          deckTitle: o.deckTitle,
          storyTheme: o.storyTheme,
          deckType: st.config.deckType,
          existingTitles: o.slides
            .filter((s) => s.slideNumber !== id && s.title.trim())
            .map((s) => s.title),
          position: pos < 0 ? 0 : pos,
          hint: hint || undefined,
        });
        update((cur) => ({
          ...cur,
          slides: cur.slides.map((s) =>
            s.slideNumber === id
              ? { ...s, title: card.title, bullets: card.bullets }
              : s,
          ),
        }));
        persist();
      } catch (error) {
        message.error(
          isApiError(error) ? error.message : "Couldn't generate this card.",
        );
      } finally {
        setAiBusy((prev) => prev.filter((x) => x !== id));
      }
    },
    [update, persist, message],
  );

  const regenerate = useCallback(async () => {
    if (config.prompt.trim().length < 3) {
      message.error("Add a prompt to regenerate.");
      return;
    }
    setRegenerating(true);
    try {
      const fresh = await decksApi.outline({
        prompt: config.prompt,
        noOfSlides: config.noOfSlides,
        deckType: config.deckType,
        theme: config.theme,
        canvas: config.canvas,
        accentColor: config.accentColor || undefined,
        model: config.model,
      });
      setOutline(fresh);
      message.success("Outline regenerated.");
    } catch (error) {
      message.error(
        isApiError(error) ? error.message : "Couldn't regenerate the outline.",
      );
    } finally {
      setRegenerating(false);
    }
  }, [config, message, setOutline]);

  if (hydrating) {
    return (
      <div className={`grid min-h-full place-items-center ${GRADIENT}`}>
        <Spin size="large" />
      </div>
    );
  }
  if (!outline) return null;

  const onGenerate = () => {
    const cleaned: DeckOutline = {
      ...outline,
      slides: outline.slides.map((s, i) => ({
        ...s,
        slideNumber: i + 1,
        bullets: s.bullets.map((b) => b.trim()).filter(Boolean),
      })),
    };
    persist();
    run({
      prompt: config.prompt,
      noOfSlides: cleaned.slides.length,
      deckType: config.deckType,
      theme: config.theme,
      canvas: config.canvas,
      accentColor: config.accentColor || undefined,
      model: config.model,
      outline: cleaned,
    });
  };

  const generating =
    state.status === "starting" ||
    state.status === "streaming" ||
    state.status === "done";

  let content: ReactNode;

  if (generating) {
    const done = state.status === "done";
    const pct = state.total
      ? Math.round((state.completed / state.total) * 100)
      : 0;

    content = (
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Title level={3} className="!mb-1">
              {state.deckTitle ?? outline.deckTitle ?? "Generating…"}
            </Title>
            <Text type="secondary">
              {done ? "Ready" : "Generating your deck"} · {state.completed}/
              {state.total || "…"} slides
            </Text>
          </div>
          {done && state.deckId && (
            <Button
              type="primary"
              size="large"
              onClick={() => navigate(deckPath(state.deckId as string))}
            >
              Open deck
            </Button>
          )}
        </div>

        <Progress
          className="mt-3"
          showInfo={false}
          status={done ? "success" : "active"}
          percent={done ? 100 : pct}
        />

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {state.slides.length === 0
            ? // Before the first SSE "outline" event arrives, show skeletons for the
              // planned slides (we know their titles from the approved outline).
              outline.slides.map((s, i) => (
                <SlideSkeleton
                  key={s.slideNumber}
                  index={i + 1}
                  title={s.title}
                />
              ))
            : state.slides.map((s) =>
                s.status === "ready" && s.html ? (
                  <Card
                    key={s.slideNumber}
                    size="small"
                    styles={{ body: { padding: 0 } }}
                    className="overflow-hidden"
                  >
                    <SlideFrame html={s.html} css={state.css ?? ""} canvas={state.canvas} />
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <Text className="truncate text-[13px]" title={s.title}>
                        {s.slideNumber}. {s.title || "Untitled"}
                      </Text>
                      <Tag color="success" className="!m-0">
                        Ready
                      </Tag>
                    </div>
                  </Card>
                ) : s.status === "error" ? (
                  <Card
                    key={s.slideNumber}
                    size="small"
                    styles={{ body: { padding: 0 } }}
                    className="overflow-hidden"
                  >
                    <div className="grid aspect-video place-items-center border-b border-zinc-100 bg-zinc-50">
                      <Text type="danger" className="text-[13px]">
                        Failed
                      </Text>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <Text className="truncate text-[13px]" title={s.title}>
                        {s.slideNumber}. {s.title || "Untitled"}
                      </Text>
                      <Tag color="error" className="!m-0">
                        Error
                      </Tag>
                    </div>
                  </Card>
                ) : (
                  <SlideSkeleton
                    key={s.slideNumber}
                    index={s.slideNumber}
                    title={s.title}
                  />
                ),
              )}
        </div>
      </div>
    );
  } else {
    const order = outline.slides.map((s) => s.slideNumber);
    content = (
      <>
        <div className="flex items-center gap-3 pl-2 pr-8 pt-6">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(paths.createGenerate)}
            className="text-zinc-500"
          >
            Back
          </Button>
          <Breadcrumb
            items={[
              { title: <Link to={paths.dashboard}>Home</Link> },
              { title: <Link to={paths.create}>Create</Link> },
              { title: <Link to={paths.createGenerate}>Generate</Link> },
              { title: "Outline" },
            ]}
          />
        </div>

        <div className="mx-auto max-w-3xl px-8 pt-4 pb-28">
          <h1 className="text-center text-3xl font-semibold tracking-tight text-zinc-900">
            {outline.deckTitle || "Review outline"}
          </h1>
          <p className="mt-2 mb-6 text-center text-zinc-500">
            Tweak the outline, reorder cards, and set your options — then generate.
          </p>

          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
            <Select
              value={config.noOfSlides}
              onChange={changeCardCount}
              options={CARD_COUNT_OPTIONS.map((n) => ({
                value: n,
                label: `${n} cards`,
              }))}
              style={{ width: 120 }}
            />
            <ThemePicker
              value={config.theme}
              onChange={(v) => setConfig({ theme: v })}
            />
            <Select
              value={config.canvas}
              onChange={(v) => setConfig({ canvas: v })}
              options={CANVAS_OPTIONS}
              disabled={config.deckType !== "social_post"}
              style={{ width: 180 }}
            />
            <ShimmerBorder>
              <Select
                value={config.model}
                onChange={(v) => setConfig({ model: v })}
                options={MODEL_OPTIONS}
                variant="borderless"
                suffixIcon={<Sparkles className="text-indigo-500" />}
                style={{ width: 190 }}
              />
            </ShimmerBorder>
          </div>

          {/* Prompt + regenerate */}
          <div className="relative">
            <Input.TextArea
              value={config.prompt}
              onChange={(e) => setConfig({ prompt: e.target.value })}
              placeholder="Describe what you'd like to make"
              autoSize={{ minRows: 2, maxRows: 5 }}
              className="!pr-12 !text-[15px]"
            />
            <Button
              type="text"
              aria-label="Regenerate outline"
              icon={<ReloadOutlined spin={regenerating} />}
              disabled={regenerating}
              onClick={regenerate}
              className="!absolute !right-1.5 !top-1.5 text-zinc-400 hover:!text-indigo-600"
            />
          </div>

          <div className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-wide text-zinc-400">
            Outline
          </div>

          <Reorder.Group
            axis="y"
            as="div"
            layoutScroll
            values={order}
            onReorder={onReorder}
            className="flex flex-col gap-2.5"
          >
            {outline.slides.map((slide, i) => (
              <OutlineCard
                key={slide.slideNumber}
                slide={slide}
                index={i}
                busy={aiBusy.includes(slide.slideNumber)}
                onTitle={editTitle}
                onBullet={editBullet}
                onAddBullet={addBullet}
                onRemoveBullet={removeBullet}
                onRemove={removeSlide}
                onAiFill={aiFill}
              />
            ))}
          </Reorder.Group>

          <Button
            block
            icon={<PlusOutlined />}
            onClick={addSlide}
            className="!mt-2.5 border-dashed text-zinc-500"
          >
            Add card
          </Button>
        </div>

        <CornerGuide />
      </>
    );
  }

  return (
    <div className={`relative min-h-full ${GRADIENT}`}>
      {content}

      {!generating && (
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-5 border-t border-zinc-200 bg-white/90 px-8 py-4 backdrop-blur">
          <span className="hidden text-sm text-zinc-500 sm:inline">
            {outline.slides.length} cards total
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-600">
            <ThunderboltOutlined className="text-amber-500" />
            {workspace?.credits ?? 0} credits
          </span>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={onGenerate}
            className="!shadow-[0_0_18px_rgba(79,70,229,0.55)] transition-shadow duration-200 hover:!shadow-[0_0_26px_rgba(79,70,229,0.75)]"
          >
            Generate
          </Button>
        </div>
      )}
    </div>
  );
};

export default OutlineReviewPage;
