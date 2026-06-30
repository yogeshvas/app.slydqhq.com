import { useEffect, useState } from "react";
import {
  DownloadOutlined,
  LockOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button, Dropdown, Input, Result, Spin } from "antd";
import { useParams } from "react-router-dom";
import { useDocumentTitle } from "@/lib/use-document-title";
import { isApiError } from "@/lib/api-client";
import { publicApi } from "../api/public.api";
import { SlideFrame } from "../components/SlideFrame";
import { PresentMode } from "../components/PresentMode";
import type { ExportFormat, PublicDeck } from "../types/deck.types";

/**
 * Unauthenticated public deck viewer (/share/:token). Renders the deck read-only,
 * gated by a password when the owner set one, with a download menu when allowed.
 */
const PublicDeckPage = () => {
  const { token } = useParams();
  const { message } = AntApp.useApp();

  const [data, setData] = useState<PublicDeck | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(data?.deck?.title ?? "Shared deck");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = async (pwd?: string) => {
    if (!token) return;
    setSubmitting(Boolean(pwd));
    try {
      const res = await publicApi.view(token, pwd);
      setData(res);
      setError(null);
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        message.error("Incorrect password.");
      } else {
        setError(isApiError(e) ? e.message : "This deck isn't available.");
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const runExport = async (format: ExportFormat) => {
    if (!token) return;
    setExporting(format);
    const hide = message.loading(`Preparing ${format.toUpperCase()}…`, 0);
    try {
      const { url } = await publicApi.export(token, format, password || undefined);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      message.error(isApiError(e) ? e.message : "Download failed.");
    } finally {
      hide();
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-100">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-100">
        <Result status="404" title="Deck unavailable" subTitle={error} />
      </div>
    );
  }

  // Password gate.
  if (data?.passwordRequired) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-100 px-4">
        <div className="w-full max-w-sm border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-zinc-800">
            <LockOutlined />
            <span className="text-[15px] font-semibold">
              This deck is password protected
            </span>
          </div>
          <p className="mb-4 text-[13px] text-zinc-500">
            Enter the password to view it.
          </p>
          <Input.Password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={() => void load(password)}
            placeholder="Password"
            autoFocus
          />
          <Button
            type="primary"
            block
            className="!mt-3"
            loading={submitting}
            disabled={!password}
            onClick={() => void load(password)}
          >
            View deck
          </Button>
        </div>
      </div>
    );
  }

  const deck = data?.deck;
  const slides = data?.slides ?? [];
  const css = deck?.styleCss ?? "";

  const exportItems = [
    { key: "pdf", label: "Download PDF" },
    { key: "pptx", label: "Download PowerPoint" },
    { key: "png", label: "Download PNGs (zip)" },
  ].map((it) => ({
    ...it,
    icon: <DownloadOutlined />,
    onClick: () => void runExport(it.key as ExportFormat),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
      {/* Public top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white px-5 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-zinc-800">
          {deck?.title || "Shared deck"}
        </span>
        <Button
          icon={<PlayCircleOutlined />}
          onClick={() => setPresenting(true)}
          disabled={slides.length === 0}
        >
          Present
        </Button>
        {data?.allowDownload && (
          <Dropdown trigger={["click"]} menu={{ items: exportItems }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={Boolean(exporting)}
            >
              Download
            </Button>
          </Dropdown>
        )}
      </header>

      {/* Read-only slide stack */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {slides.map((s) => (
            <div
              key={s._id}
              className="overflow-hidden rounded-xl border border-zinc-300 shadow-sm"
            >
              <SlideFrame html={s.html} css={css} canvas={deck?.canvas} />
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white py-3 text-center text-[12px] text-zinc-400">
        Made with Slyde HQ
      </footer>

      {presenting && (
        <PresentMode
          slides={slides.map((s) => ({
            _id: s._id,
            deckId: deck?._id ?? "",
            position: 0,
            slideNumber: s.slideNumber,
            layout: "",
            title: s.title,
            html: s.html,
            status: "ready",
            notes: s.notes,
          }))}
          css={css}
          canvas={deck?.canvas}
          onClose={() => setPresenting(false)}
        />
      )}
    </div>
  );
};

export default PublicDeckPage;
