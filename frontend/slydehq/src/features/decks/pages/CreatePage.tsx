import type { ReactNode } from "react";
import {
  ClockCircleOutlined,
  HomeOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useDocumentTitle } from "@/lib/use-document-title";
import { EXAMPLE_PROMPTS, getRecentPrompts } from "../recent-prompts";

// Soft top-to-bottom gradient behind the create flow.
const GRADIENT = "bg-gradient-to-b from-white via-indigo-50 to-sky-100";

// Create modes. Covers use the images in /public. Add a mode to extend the grid.
interface CreateMode {
  key: string;
  title: string;
  description: string;
  image: string;
  enabled: boolean;
}

const CREATE_MODES: CreateMode[] = [
  {
    key: "generate",
    title: "Generate",
    description: "Create from a one-line prompt in a few seconds.",
    image: "/1.jpeg",
    enabled: true,
  },
  {
    key: "paste",
    title: "Paste in text",
    description: "Create from notes, an outline, or existing content.",
    image: "/2.jpeg",
    enabled: false,
  },
  {
    key: "template",
    title: "Create from template",
    description: "Use the structure or layouts from a template.",
    image: "/3.jpeg",
    enabled: false,
  },
  {
    key: "import",
    title: "Import file or URL",
    description: "Enhance existing docs, decks, or webpages.",
    image: "/4.jpeg",
    enabled: false,
  },
];

const CreatePage = () => {
  useDocumentTitle("Create");
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const recentPrompts = getRecentPrompts();
  const hasRecent = recentPrompts.length > 0;
  const promptList = hasRecent ? recentPrompts : EXAMPLE_PROMPTS;
  const promptHeading = hasRecent ? "Your recent prompts" : "Example prompts";

  // Open the Generate page, optionally seeding the prompt.
  const goGenerate = (prompt?: string) =>
    navigate(paths.createGenerate, prompt ? { state: { prompt } } : undefined);

  return (
    <div className={`min-h-full ${GRADIENT}`}>
      <div className="px-8 py-6">
        <Button
          type="text"
          icon={<HomeOutlined />}
          onClick={() => navigate(paths.dashboard)}
          className="text-zinc-600"
        >
          Home
        </Button>

        <div className="mx-auto max-w-5xl">
          <h1 className="mt-6 mb-10 text-center text-4xl font-semibold tracking-tight text-zinc-900">
            Create with AI
          </h1>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CREATE_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                disabled={!m.enabled}
                onClick={() =>
                  m.enabled
                    ? goGenerate()
                    : message.info(`${m.title} is coming soon.`)
                }
                className={`group flex flex-col overflow-hidden border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-sm ${
                  m.enabled ? "shimmer-border" : ""
                }`}
              >
                <div className="aspect-[16/10] overflow-hidden bg-zinc-100">
                  <img
                    src={m.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-zinc-900">{m.title}</h3>
                    {!m.enabled && <Tag className="!m-0">Soon</Tag>}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                    {m.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="mb-4 text-center text-lg font-semibold text-zinc-800">
              {promptHeading}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {promptList.map((prompt: string): ReactNode => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => goGenerate(prompt)}
                  className="flex w-full items-center justify-between gap-3 border border-zinc-200 bg-white/70 px-5 py-4 text-left shadow-sm transition hover:bg-white hover:shadow-md"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ClockCircleOutlined className="shrink-0 text-zinc-400" />
                    <span className="truncate text-[14px] text-zinc-800">
                      {prompt}
                    </span>
                  </div>
                  <RightOutlined className="shrink-0 text-zinc-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePage;
