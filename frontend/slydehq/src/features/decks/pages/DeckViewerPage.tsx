import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftOutlined,
  BlockOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExportOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FontColorsOutlined,
  HolderOutlined,
  MoreOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  SaveOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  StarFilled,
  StarOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { App as AntApp, Button, Dropdown, Input, Result, Segmented, Spin, Tooltip } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { isApiError } from "@/lib/api-client";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { decksApi } from "../api/decks.api";
import { deckKeys, useDeck, useToggleFavorite } from "../hooks/use-decks";
import { PresentMode } from "../components/PresentMode";
import { ThemePicker } from "../components/ThemeSelect";
import { ShareExportModal } from "../components/ShareExportModal";
import { SlideSkeleton } from "../components/SlideSkeleton";
import { EditableSlide } from "../components/EditableSlide";
import { SlideFrame } from "../components/SlideFrame";
import { SlideInspector } from "../components/SlideInspector";
import { MediaLibrary } from "@/features/media/components/MediaLibrary";
import type { MediaItem } from "@/features/media/types";
import type { Slide, SlideContent } from "../types/deck.types";

type SaveStatus = "idle" | "unsaved" | "saving" | "saved";

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "All changes saved",
};

// Right-edge tool rail (Gamma-style). Each opens a panel on the right.
type ToolKey = "ai" | "content" | "image" | "media" | "notes";
const TOOLS: { key: ToolKey; icon: ReactNode; label: string }[] = [
  { key: "ai", icon: <ThunderboltOutlined />, label: "Ask AI" },
  { key: "content", icon: <FontColorsOutlined />, label: "Edit content" },
  { key: "image", icon: <PictureOutlined />, label: "Image" },
  { key: "media", icon: <FolderOpenOutlined />, label: "Media library" },
  { key: "notes", icon: <FileTextOutlined />, label: "Speaker notes" },
];

// Canvas zoom: base column width (max-w-4xl = 56rem) scaled by the zoom factor.
const ZOOM_BASE_PX = 896;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

const DeckViewerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useDeck(id);
  useDocumentTitle(data?.deck.title ?? "Deck");
  const favorite = useToggleFavorite();

  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  // Right tool rail: which tool's panel is open (null = collapsed to the rail).
  const [activeTool, setActiveTool] = useState<ToolKey | null>("ai");
  const [zoom, setZoom] = useState(1);
  // Bumped on Discard to force the slide iframes to remount (reload saved HTML).
  const [revertKey, setRevertKey] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [retheming, setRetheming] = useState(false);

  // All slides are mounted at once (vertical scroll), so we keep one HTML getter
  // per slide id rather than a single "current slide" ref.
  const getHtmlMap = useRef<Record<string, () => string>>({});
  // Slides the user has actually inline-edited. We only read HTML back from these
  // so untouched (but iframe-normalised) slides aren't flagged dirty or reloaded.
  const touched = useRef<Set<string>>(new Set());
  const savedHtml = useRef<Record<string, string>>({});
  const savedTitle = useRef("");
  const initialized = useRef(false);
  // True if we ever saw this deck mid-generation → toast when it flips to ready.
  const wasGenerating = useRef(false);

  // The scroll container + each slide's wrapper, so we can sync the selected
  // slide to whatever is centered in view and scroll-to a slide on thumbnail click.
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideEls = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRaf = useRef<number | null>(null);

  // ── Undo / redo for structured slide changes (AI edit, image, content) ──
  // Each entry is a full snapshot of ONE slide taken BEFORE a change. Restoring
  // re-PATCHes that slide to the snapshot. Kept in refs so the keydown handler
  // never reads a stale stack; flags drive the toolbar buttons.
  const undoRef = useRef<Slide[]>([]);
  const redoRef = useRef<Slide[]>([]);
  const slidesRef = useRef<Slide[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);
  const syncHistory = () => {
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  };
  /** Remember a slide's pre-change state so it can be undone (caps the stack). */
  const pushUndo = (prev: Slide) => {
    undoRef.current = [...undoRef.current, structuredClone(prev)].slice(-50);
    redoRef.current = [];
    syncHistory();
  };

  // Seed local state once the deck is READY (don't clobber edits on refetch, and
  // don't lock in partial slides captured while it was still generating).
  useEffect(() => {
    if (data && data.deck.status !== "generating" && !initialized.current) {
      initialized.current = true;
      // Was being watched while generating → toast on completion.
      if (wasGenerating.current) message.success("🎉 Your deck is ready!");
      setSlides(data.slides);
      setTitle(data.deck.title);
      savedTitle.current = data.deck.title;
      savedHtml.current = Object.fromEntries(
        data.slides.map((s) => [s._id, s.html]),
      );
    }
    if (data?.deck.status === "generating") wasGenerating.current = true;
  }, [data, message]);

  const css = data?.deck.styleCss ?? "";
  const canvas = data?.deck.canvas;
  const current = slides[index];

  // Optimistic slides have a client-side id until the server create resolves —
  // they must never be sent to the backend (their id isn't a real ObjectId).
  const isTemp = (sid: string) => sid.startsWith("tmp_");

  // Pull the latest edited HTML out of the slides the user actually touched.
  const captureAll = (list: Slide[]): Slide[] =>
    list.map((s) => {
      if (!touched.current.has(s._id)) return s;
      const html = getHtmlMap.current[s._id]?.();
      return html != null ? { ...s, html } : s;
    });

  const selectSlide = (i: number) => {
    setSlides((prev) => captureAll(prev));
    setIndex(i);
    slideEls.current[slides[i]?._id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // While scrolling the stacked deck, keep the inspector + thumbnail highlight on
  // whichever slide is closest to the centre of the viewport.
  const syncIndexToScroll = () => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      const root = scrollRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const mid = rootRect.top + rootRect.height / 2;
      let bestI = 0;
      let bestDist = Infinity;
      slides.forEach((s, i) => {
        const el = slideEls.current[s._id];
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          bestI = i;
        }
      });
      setIndex((cur) => (cur === bestI ? cur : bestI));
    });
  };

  const saveAll = async (silent = false) => {
    if (!id) return;
    const captured = captureAll(slides);
    setSlides(captured);
    // Skip optimistic (temp) slides — they have no real id yet.
    const changed = captured.filter(
      (s) => !isTemp(s._id) && savedHtml.current[s._id] !== s.html,
    );
    if (changed.length === 0) {
      if (!silent) message.info("No changes to save.");
      setStatus("saved");
      return;
    }
    setStatus("saving");
    try {
      await Promise.all(
        changed.map((s) => decksApi.updateSlide(id, s._id, { html: s.html })),
      );
      changed.forEach((s) => {
        savedHtml.current[s._id] = s.html;
      });
      qc.invalidateQueries({ queryKey: deckKeys.list() });
      setStatus("saved");
      if (!silent) message.success("Saved.");
    } catch (error) {
      setStatus("unsaved");
      message.error(isApiError(error) ? error.message : "Couldn't save changes.");
    }
  };

  // Manual save only — edits just flag the deck dirty (no autosave) so the user
  // controls when changes persist and can discard before saving.
  const markDirty = () => {
    setStatus("unsaved");
  };

  // Discard unsaved inline edits. The edits live in the iframe DOM (not React
  // state), so we reset each slide's html to the saved HTML AND bump revertKey to
  // force the iframes to remount — reloading the saved content and dropping edits.
  const discardChanges = () => {
    setSlides((prev) =>
      prev.map((s) => ({ ...s, html: savedHtml.current[s._id] ?? s.html })),
    );
    touched.current.clear();
    setRevertKey((k) => k + 1);
    setStatus("idle");
    message.info("Unsaved changes discarded.");
  };

  // Warn before leaving (refresh/close/navigate) while changes are unsaved.
  useEffect(() => {
    if (status !== "unsaved") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  const saveTitle = async () => {
    if (!id || title.trim() === savedTitle.current || !title.trim()) return;
    try {
      await decksApi.updateDeck(id, { title: title.trim() });
      savedTitle.current = title.trim();
      qc.invalidateQueries({ queryKey: deckKeys.list() });
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't save title.");
    }
  };

  // ── Structured editing (re-renders server-side) ──
  const [busy, setBusy] = useState(false);

  // Replace the current slide in local state with a server-returned one.
  const replaceCurrent = (updated: Slide) => {
    setSlides((prev) =>
      prev.map((s) => (s._id === updated._id ? updated : s)),
    );
    savedHtml.current[updated._id] = updated.html;
    setStatus("saved");
  };

  const applyContent = async (content: SlideContent) => {
    if (!id || !current) return;
    const prev = current;
    setBusy(true);
    try {
      replaceCurrent(await decksApi.updateSlide(id, current._id, { content }));
      pushUndo(prev);
      message.success("Slide updated.");
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't update slide.");
    } finally {
      setBusy(false);
    }
  };

  // One AI pass for everything pending: instruction + layout (one engine call)
  // and/or a new image (a second call). Returns whether it succeeded so the
  // inspector can clear its inputs.
  const applyAi = async (args: {
    instruction?: string;
    layout?: string;
    imagePrompt?: string;
    imageSource?: "ai" | "unsplash";
    imageUrl?: string;
  }): Promise<boolean> => {
    if (!id || !current) return false;
    const wantsEdit = Boolean(args.instruction?.trim() || args.layout);
    const wantsImage = Boolean(args.imagePrompt?.trim() || args.imageUrl);
    if (!wantsEdit && !wantsImage) return false;
    const prev = current;
    setBusy(true);
    try {
      if (wantsEdit) {
        replaceCurrent(
          await decksApi.aiEditSlide(id, current._id, {
            instruction: args.instruction,
            layout: args.layout,
          }),
        );
      }
      if (wantsImage) {
        replaceCurrent(
          await decksApi.regenerateImage(id, current._id, {
            prompt: args.imagePrompt,
            source: args.imageUrl ? "unsplash" : args.imageSource ?? "ai",
            imageUrl: args.imageUrl,
          }),
        );
      }
      pushUndo(prev);
      message.success("AI updated the slide.");
      return true;
    } catch (error) {
      message.error(isApiError(error) ? error.message : "AI update failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Apply a saved library image to the current slide (free — reuses the picked-URL
  // path). The slide should be on an image layout for the picture to show.
  const applyMediaImage = async (item: MediaItem) => {
    if (!id || !current) return;
    const prev = current;
    setBusy(true);
    try {
      replaceCurrent(
        await decksApi.regenerateImage(id, current._id, {
          source: "unsplash",
          imageUrl: item.url,
        }),
      );
      pushUndo(prev);
      message.success("Image applied to the slide.");
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't apply image.");
    } finally {
      setBusy(false);
    }
  };

  // ── Undo / redo: restore a slide snapshot (re-render from its content). ──
  const restoreSnapshot = async (snap: Slide) => {
    if (!id) return;
    setBusy(true);
    try {
      const patch =
        snap.content && typeof snap.content === "object"
          ? { content: snap.content as SlideContent }
          : { html: snap.html };
      const updated = await decksApi.updateSlide(id, snap._id, patch);
      setSlides((prev) =>
        prev.map((s) => (s._id === updated._id ? updated : s)),
      );
      savedHtml.current[updated._id] = updated.html;
      setStatus("saved");
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't restore.");
    } finally {
      setBusy(false);
    }
  };

  /** Bring the snapshot's slide into view + select it before restoring. */
  const focusSlide = (slideId: string) => {
    const i = slidesRef.current.findIndex((s) => s._id === slideId);
    if (i >= 0) {
      setIndex(i);
      slideEls.current[slideId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const undo = async () => {
    const snap = undoRef.current.at(-1);
    if (!snap) return;
    undoRef.current = undoRef.current.slice(0, -1);
    const live = slidesRef.current.find((s) => s._id === snap._id);
    if (live) redoRef.current = [...redoRef.current, structuredClone(live)];
    syncHistory();
    focusSlide(snap._id);
    await restoreSnapshot(snap);
    message.info("Undone");
  };

  const redo = async () => {
    const snap = redoRef.current.at(-1);
    if (!snap) return;
    redoRef.current = redoRef.current.slice(0, -1);
    const live = slidesRef.current.find((s) => s._id === snap._id);
    if (live) undoRef.current = [...undoRef.current, structuredClone(live)];
    syncHistory();
    focusSlide(snap._id);
    await restoreSnapshot(snap);
    message.info("Redone");
  };

  const searchStock = async (query: string): Promise<string[]> => {
    try {
      return await decksApi.stockSearch(query);
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't search photos.");
      return [];
    }
  };

  // Save speaker notes for the current slide (metadata — no re-render).
  const saveNotes = async (notes: string) => {
    if (!id || !current) return;
    setSlides((prev) =>
      prev.map((s) => (s._id === current._id ? { ...s, notes } : s)),
    );
    try {
      await decksApi.updateSlide(id, current._id, { notes });
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't save notes.");
    }
  };

  // Restyle the whole deck → swap in re-rendered slides + new shared stylesheet.
  const changeTheme = async (patch: { theme?: string; accentColor?: string }) => {
    if (!id) return;
    setRetheming(true);
    try {
      const result = await decksApi.changeTheme(id, patch);
      setSlides(result.slides);
      result.slides.forEach((s) => {
        savedHtml.current[s._id] = s.html;
      });
      touched.current.clear();
      // Refresh the cached deck so `css` (deck.styleCss) updates everywhere.
      qc.setQueryData(deckKeys.detail(id), (old: typeof data | undefined) =>
        old ? { ...old, deck: result.deck, slides: result.slides } : old,
      );
      setRevertKey((k) => k + 1); // remount iframes with the new css
      setStatus("idle");
      message.success("Theme updated.");
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't change theme.");
    } finally {
      setRetheming(false);
    }
  };

  // ── Drag-and-drop reorder ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const moveSlide = async (from: number, to: number) => {
    if (!id || from === to || to < 0 || to >= slides.length) return;
    const next = captureAll(slides);
    const reordered = [...next];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setSlides(reordered);
    // Keep the currently-open slide selected after the move.
    const currentId = next[index]?._id;
    setIndex(reordered.findIndex((s) => s._id === currentId));
    // Don't persist while an optimistic (temp) slide is still in flight — its id
    // isn't a real ObjectId yet; the order syncs once it resolves.
    if (reordered.some((s) => isTemp(s._id))) return;
    try {
      await decksApi.reorderSlides(id, reordered.map((s) => s._id));
    } catch (error) {
      message.error(isApiError(error) ? error.message : "Couldn't reorder.");
    }
  };

  const onDrop = (to: number) => {
    if (dragIndex !== null) void moveSlide(dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
  };

  // ── Optimistic slide ops — update the UI instantly, sync in the background ──
  const tempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  /** Insert `temp` after index `i` immediately, then swap in the server slide. */
  const optimisticInsert = (
    i: number,
    temp: Slide,
    call: () => Promise<Slide>,
    failMsg: string,
    okMsg?: string,
  ) => {
    setSlides((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, temp);
      return next;
    });
    setIndex(i + 1);
    if (okMsg) message.success(okMsg); // instant feedback, not after the round-trip
    call()
      .then((real) => {
        setSlides((prev) => prev.map((s) => (s._id === temp._id ? real : s)));
        savedHtml.current[real._id] = real.html;
      })
      .catch((error) => {
        setSlides((prev) => prev.filter((s) => s._id !== temp._id));
        message.error(isApiError(error) ? error.message : failMsg);
      });
  };

  const blankSlide = (over: Partial<Slide> = {}): Slide => ({
    _id: tempId(),
    deckId: id ?? "",
    position: 0,
    layout: "minimal",
    title: "New slide",
    html: "",
    status: "ready",
    ...over,
  });

  const addSlide = () => {
    if (!id) return;
    optimisticInsert(
      slides.length - 1,
      blankSlide(),
      () => decksApi.addSlide(id, { afterSlideId: slides[slides.length - 1]?._id }),
      "Couldn't add slide.",
    );
  };

  const addBelow = (i: number) => {
    if (!id) return;
    const afterId = slides[i]?._id;
    optimisticInsert(
      i,
      blankSlide(),
      () => decksApi.addSlide(id, { afterSlideId: afterId }),
      "Couldn't add slide.",
    );
  };

  const duplicateSlideAt = (i: number) => {
    if (!id) return;
    const src = slides[i];
    optimisticInsert(
      i,
      { ...src, _id: tempId() },
      () => decksApi.duplicateSlide(id, src._id),
      "Couldn't duplicate.",
      "Slide duplicated",
    );
  };

  const deleteSlideAt = (i: number, silent = false) => {
    if (!id || slides.length <= 1) {
      message.info("A deck needs at least one slide.");
      return;
    }
    const prev = slides;
    const target = prev[i];
    // Optimistic remove (instant). A temp slide was never persisted — just drop it.
    setSlides(prev.filter((_, j) => j !== i));
    setIndex((cur) => Math.max(0, Math.min(cur, prev.length - 2)));
    if (!silent) message.success("Slide deleted");
    if (isTemp(target._id)) return;
    decksApi.deleteSlide(id, target._id).catch((error) => {
      setSlides(prev); // rollback
      message.error(isApiError(error) ? error.message : "Couldn't delete — restored.");
    });
  };

  // ── Clipboard (Copy / Cut / Paste of whole slides) ──
  const clipboard = useRef<{ content: SlideContent; slide: Slide } | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);

  const copySlideAt = (i: number) => {
    const slide = slides[i];
    if (!slide?.content || typeof slide.content !== "object") {
      message.info("This slide can't be copied (no structured content).");
      return;
    }
    clipboard.current = {
      content: JSON.parse(JSON.stringify(slide.content)),
      slide,
    };
    setHasClipboard(true);
    message.success("Slide copied.");
  };

  const cutSlideAt = (i: number) => {
    const slide = slides[i];
    if (!slide?.content || typeof slide.content !== "object") {
      message.info("This slide can't be cut (no structured content).");
      return;
    }
    clipboard.current = {
      content: JSON.parse(JSON.stringify(slide.content)),
      slide,
    };
    setHasClipboard(true);
    message.success("Slide cut");
    deleteSlideAt(i, true);
  };

  const pasteAfter = (i: number) => {
    const cb = clipboard.current;
    if (!id || !cb) return;
    const afterId = slides[i]?._id;
    // Show the copied slide instantly (reuse its html), then sync.
    optimisticInsert(
      i,
      { ...cb.slide, _id: tempId() },
      () => decksApi.addSlide(id, { afterSlideId: afterId, content: cb.content }),
      "Couldn't paste.",
      "Slide pasted",
    );
  };

  // Keyboard shortcuts for the selected slide (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Undo / redo for structured slide changes (image, AI edit, content).
      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
        return;
      }
      if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        void redo();
        return;
      }

      if (mod && key === "c") {
        e.preventDefault();
        copySlideAt(index);
      } else if (mod && key === "x") {
        e.preventDefault();
        cutSlideAt(index);
      } else if (mod && key === "v") {
        e.preventDefault();
        void pasteAfter(index);
      } else if (mod && key === "d") {
        e.preventDefault();
        void duplicateSlideAt(index);
      } else if (key === "delete" || key === "backspace") {
        e.preventDefault();
        void deleteSlideAt(index);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides]);

  // Shared context-menu items for a slide (used by ⋯ click and right-click).
  const slideMenuItems = (i: number): MenuProps["items"] => [
    {
      key: "header",
      type: "group",
      label: (
        <span className="block max-w-[200px] truncate text-[12px] text-zinc-400">
          {slides[i]?.title || `Slide ${i + 1}`}
        </span>
      ),
    },
    { key: "cut", icon: <ScissorOutlined />, label: "Cut", extra: "⌘X", onClick: () => cutSlideAt(i) },
    { key: "copy", icon: <CopyOutlined />, label: "Copy", extra: "⌘C", onClick: () => copySlideAt(i) },
    {
      key: "paste",
      icon: <SnippetsOutlined />,
      label: "Paste",
      extra: "⌘V",
      disabled: !hasClipboard,
      onClick: () => void pasteAfter(i),
    },
    {
      key: "duplicate",
      icon: <BlockOutlined />,
      label: "Duplicate",
      extra: "⌘D",
      onClick: () => duplicateSlideAt(i),
    },
    { type: "divider" },
    { key: "add-below", icon: <PlusOutlined />, label: "Add slide below", onClick: () => addBelow(i) },
    { type: "divider" },
    {
      key: "delete",
      icon: <DeleteOutlined />,
      label: "Delete",
      danger: true,
      onClick: () => deleteSlideAt(i),
    },
  ];

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center bg-zinc-50">
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="grid h-full place-items-center bg-zinc-50">
        <Result
          status="error"
          title="Couldn't load this deck"
          extra={
            <Button type="primary" onClick={() => navigate(paths.dashboard)}>
              Back to dashboard
            </Button>
          }
        />
      </div>
    );
  }

  // Deck still generating — show a live generating view (polls until ready) instead
  // of the editor. Slides fill in as they're produced; flips to the editor on ready.
  if (data.deck.status === "generating") {
    const liveSlides = data.slides ?? [];
    const total = Math.max(liveSlides.length, 1);
    const ready = liveSlides.filter((s) => s.status === "ready").length;
    return (
      <div className="h-full overflow-y-auto bg-zinc-100">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(paths.dashboard)}
            className="mb-3 text-zinc-500"
          >
            Back to decks
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {data.deck.title || "Generating…"}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-[13px] text-zinc-500">
            <Spin size="small" /> Generating your deck · {ready}/{total} slides ready
          </p>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {liveSlides.map((s, i) =>
              s.status === "ready" && s.html ? (
                <div
                  key={s._id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                >
                  <SlideFrame html={s.html} css={css} canvas={canvas} />
                </div>
              ) : (
                <SlideSkeleton key={s._id} index={i + 1} title={s.title} />
              ),
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-100">
      {/* Editor top bar */}
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(paths.dashboard)}
          className="shrink-0 text-zinc-500"
        />
        <Input
          variant="borderless"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onPressEnter={saveTitle}
          className="!min-w-0 !flex-1 !text-[15px] !font-medium !text-zinc-800"
          placeholder="Untitled deck"
        />
        <Tooltip title={data.deck.favorite ? "Unfavorite" : "Add to favorites"}>
          <Button
            type="text"
            icon={
              data.deck.favorite ? (
                <StarFilled className="!text-amber-400" />
              ) : (
                <StarOutlined />
              )
            }
            onClick={() =>
              favorite.mutate({ id: id as string, favorite: !data.deck.favorite })
            }
            className="shrink-0 text-zinc-500"
          />
        </Tooltip>
        {status === "unsaved" ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-red-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="hidden md:inline">
              Unsaved changes — you might lose your progress
            </span>
            <span className="md:hidden">Unsaved</span>
          </span>
        ) : (
          <span className="hidden shrink-0 text-[12px] text-zinc-400 sm:inline">
            {STATUS_TEXT[status]}
          </span>
        )}
        <Tooltip title="Undo (⌘Z)">
          <Button
            type="text"
            icon={<UndoOutlined />}
            disabled={!canUndo || busy}
            onClick={() => void undo()}
            className="shrink-0 text-zinc-500"
          />
        </Tooltip>
        <Tooltip title="Redo (⌘⇧Z)">
          <Button
            type="text"
            icon={<RedoOutlined />}
            disabled={!canRedo || busy}
            onClick={() => void redo()}
            className="shrink-0 text-zinc-500"
          />
        </Tooltip>
        <Segmented
          size="small"
          value={mode}
          onChange={(v) => setMode(v as "edit" | "preview")}
          options={[
            { label: "Edit", value: "edit" },
            { label: "Preview", value: "preview" },
          ]}
        />
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          {retheming && <Spin size="small" />}
          <ThemePicker
            value={data.deck.theme}
            onChange={(t) => void changeTheme({ theme: t })}
          />
        </div>
        <Button
          icon={<ExportOutlined />}
          onClick={() => setShareOpen(true)}
        >
          Share
        </Button>
        <Button
          icon={<PlayCircleOutlined />}
          onClick={() => setPresenting(true)}
        >
          Present
        </Button>
        {status === "unsaved" && (
          <Button danger onClick={discardChanges}>
            Discard
          </Button>
        )}
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={status === "saving"}
          onClick={() => void saveAll(false)}
        >
          Save
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Thumbnail rail */}
        <aside className="flex w-48 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {slides.map((s, i) => (
              <Dropdown
                key={s._id}
                trigger={["contextMenu"]}
                menu={{ items: slideMenuItems(i) }}
              >
                <div
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overIndex !== i) setOverIndex(i);
                  }}
                  onDrop={() => onDrop(i)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={`group relative flex cursor-grab items-start gap-1.5 active:cursor-grabbing ${
                    dragIndex === i ? "opacity-40" : ""
                  } ${
                    overIndex === i && dragIndex !== i
                      ? "before:absolute before:-top-1 before:left-6 before:right-0 before:h-0.5 before:bg-indigo-500"
                      : ""
                  }`}
                >
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span className="text-[11px] text-zinc-400">{i + 1}</span>
                    <HolderOutlined className="text-[11px] text-zinc-300 group-hover:text-zinc-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => selectSlide(i)}
                    className={`min-w-0 flex-1 overflow-hidden rounded-lg border ${
                      i === index
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-zinc-200"
                    }`}
                  >
                    <SlideFrame html={s.html} css={css} canvas={canvas} />
                  </button>

                  {/* Per-slide menu (hover ⋯) */}
                  <Dropdown
                    trigger={["click"]}
                    placement="bottomRight"
                    menu={{ items: slideMenuItems(i) }}
                  >
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-1 top-1 hidden h-6 w-6 place-items-center rounded bg-white/95 text-zinc-500 shadow-sm ring-1 ring-black/5 hover:text-zinc-800 group-hover:grid"
                    >
                      <MoreOutlined className="text-[14px]" />
                    </button>
                  </Dropdown>
                </div>
              </Dropdown>
            ))}
          </div>
          <div className="border-t border-zinc-100 p-3">
            <Button block icon={<PlusOutlined />} loading={busy} onClick={addSlide}>
              Add slide
            </Button>
          </div>
        </aside>

        {/* Editing canvas — all slides stacked vertically, scroll through the deck.
            The next slide always peeks below, signalling the deck is scrollable. */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <main
            ref={scrollRef}
            onScroll={syncIndexToScroll}
            className="min-h-0 flex-1 overflow-auto p-8"
          >
            <div
              className="mx-auto flex flex-col gap-6"
              style={{ width: ZOOM_BASE_PX * zoom, maxWidth: zoom <= 1 ? "100%" : undefined }}
            >
              {slides.map((s, i) => (
                <div
                  key={s._id}
                  ref={(el) => {
                    if (el) slideEls.current[s._id] = el;
                    else delete slideEls.current[s._id];
                  }}
                  onMouseDown={() => setIndex(i)}
                  className={`shrink-0 overflow-hidden rounded-xl border shadow-sm transition-colors ${
                    i === index
                      ? "border-indigo-400 ring-2 ring-indigo-200"
                      : "border-zinc-300"
                  }`}
                >
                  <EditableSlide
                    key={`${s._id}-${revertKey}`}
                    html={s.html}
                    css={css}
                    canvas={canvas}
                    editable={mode === "edit"}
                    onReady={(getHtml) => {
                      getHtmlMap.current[s._id] = getHtml;
                    }}
                    onDirty={() => {
                      touched.current.add(s._id);
                      setIndex(i);
                      markDirty();
                    }}
                  />
                </div>
              ))}
              {/* Tall tail so the last slide can scroll up to centre and the
                  "next page peeking" cue holds all the way down. */}
              <div aria-hidden className="h-[20vh] shrink-0" />
            </div>
          </main>

          {/* Zoom control — floats over the canvas, like Gamma's "120%". */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 border border-zinc-200 bg-white/95 px-1 py-0.5 shadow-sm backdrop-blur">
            <Button
              type="text"
              size="small"
              icon={<ZoomOutOutlined />}
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
            />
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="min-w-[44px] text-center text-[12px] tabular-nums text-zinc-600 hover:text-zinc-900"
              title="Reset to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              type="text"
              size="small"
              icon={<ZoomInOutlined />}
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
            />
          </div>
        </div>

        {/* Structured inspector — opens for the AI/content/image tools. */}
        {mode === "edit" &&
          current &&
          activeTool &&
          activeTool !== "media" &&
          activeTool !== "notes" && (
            <SlideInspector
              slide={current}
              saving={busy}
              tab={activeTool === "content" ? "content" : "ai"}
              onTabChange={(t) => setActiveTool(t)}
              onClose={() => setActiveTool(null)}
              onApply={applyContent}
              onApplyAi={applyAi}
              onSearchStock={searchStock}
            />
          )}

        {/* Speaker notes panel for the current slide. */}
        {mode === "edit" && current && activeTool === "notes" && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <span className="text-[13px] font-semibold text-zinc-700">
                Speaker notes
              </span>
              <Button
                type="text"
                size="small"
                aria-label="Close panel"
                icon={<CloseOutlined />}
                onClick={() => setActiveTool(null)}
                className="!text-zinc-400 hover:!text-zinc-700"
              />
            </div>
            <div className="min-h-0 flex-1 p-4">
              <p className="mb-2 text-[12px] text-zinc-400">
                Notes for slide {index + 1}. Shown in Present mode (press S), never
                on the slide itself.
              </p>
              <Input.TextArea
                key={current._id}
                defaultValue={current.notes ?? ""}
                onBlur={(e) => void saveNotes(e.target.value)}
                autoSize={{ minRows: 8, maxRows: 24 }}
                placeholder="What you'll say for this slide…"
              />
            </div>
          </aside>
        )}

        {/* Media library panel — pick a saved image to drop onto the slide. */}
        {mode === "edit" && current && activeTool === "media" && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <span className="text-[13px] font-semibold text-zinc-700">
                Media library
              </span>
              <Button
                type="text"
                size="small"
                aria-label="Close panel"
                icon={<CloseOutlined />}
                onClick={() => setActiveTool(null)}
                className="!text-zinc-400 hover:!text-zinc-700"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3">
              <MediaLibrary compact onPick={(item) => void applyMediaImage(item)} />
            </div>
          </aside>
        )}

        {/* Right-edge tool rail (Gamma-style). */}
        {mode === "edit" && (
          <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-zinc-200 bg-white py-3">
            {TOOLS.map((t) => {
              const on = activeTool === t.key;
              return (
                <Tooltip key={t.key} title={t.label} placement="left">
                  <button
                    type="button"
                    aria-label={t.label}
                    onClick={() => setActiveTool((cur) => (cur === t.key ? null : t.key))}
                    className={`grid h-9 w-9 place-items-center text-[16px] transition-colors ${
                      on
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                    }`}
                  >
                    {t.icon}
                  </button>
                </Tooltip>
              );
            })}
          </nav>
        )}
      </div>

      {presenting && (
        <PresentMode
          slides={slides}
          css={css}
          canvas={canvas}
          startIndex={index}
          onClose={() => setPresenting(false)}
        />
      )}

      <ShareExportModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        deckId={id ?? ""}
        deckTitle={title}
        slideCount={slides.length}
      />
    </div>
  );
};

export default DeckViewerPage;
