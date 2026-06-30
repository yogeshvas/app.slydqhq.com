import { useEffect, useState } from "react";
import {
  ApiOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  CopyOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import { Anchor, Button, Descriptions, Segmented, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "@/lib/use-document-title";

const { Title, Paragraph, Text } = Typography;

/** Dark, copyable code block with a language label — docs-grade. */
function Code({ children, lang = "bash" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(children).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#0d1117] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
          {lang}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1 text-[12px] text-zinc-400 transition hover:text-white"
        >
          {copied ? <CheckOutlined /> : <CopyOutlined />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto px-4 py-3.5 text-[12.5px] leading-relaxed text-zinc-100">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** A code block with a cURL / JavaScript / Python language toggle. */
function MultiCode({ samples }: { samples: { lang: string; code: string }[] }) {
  const [active, setActive] = useState(samples[0].lang);
  const current = samples.find((s) => s.lang === active) ?? samples[0];
  return (
    <div className="my-4">
      <Segmented
        size="small"
        value={active}
        onChange={(v) => setActive(v as string)}
        options={samples.map((s) => ({ label: s.lang, value: s.lang }))}
      />
      <Code lang={current.lang}>{current.code}</Code>
    </div>
  );
}

const METHOD_COLOR: Record<string, string> = { GET: "blue", POST: "green", DELETE: "red" };

/** Endpoint header strip: method pill + monospace path. */
function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
      <Tag color={METHOD_COLOR[method]} className="!m-0 !font-semibold">
        {method}
      </Tag>
      <code className="text-[13.5px] font-medium text-zinc-800">{path}</code>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-zinc-100 py-10 first:border-0 first:pt-2">
      <Title level={3} className="!mb-4 !text-zinc-900">
        {title}
      </Title>
      {children}
    </section>
  );
}

const NAV = [
  { key: "overview", title: "Overview" },
  { key: "auth", title: "Authentication" },
  { key: "generate", title: "Create a generation" },
  { key: "poll", title: "Poll status" },
  { key: "credits", title: "Check credits" },
  { key: "errors", title: "Errors" },
  { key: "limits", title: "Rate limits" },
];

/** Public API documentation — premium docs look, antd + Tailwind layout. */
const ApiDocsPage = () => {
  useDocumentTitle("API documentation");
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("https://app.slydehq.com");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="min-h-screen bg-white text-zinc-800">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-[16px] font-bold text-zinc-900"
          >
            <img src="/logo.png" alt="Slyde HQ" className="h-7 w-7 object-contain" />
            Slyde HQ
            <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
              API
            </span>
          </button>
          <Button type="primary" onClick={() => navigate("/settings/api-keys")}>
            Get API key <ArrowRightOutlined />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-zinc-100 bg-gradient-to-b from-indigo-50/70 via-white to-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <Tag color="geekblue" className="!mb-3">
            <ApiOutlined /> REST API
          </Tag>
          <h1 className="m-0 text-4xl font-bold tracking-tight text-zinc-900">
            Generate decks with code
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-500">
            Create beautiful presentations programmatically. Start a generation,
            poll until it's ready, and get a shareable deck plus exports — all over a
            simple REST API.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[13px] shadow-sm">
            <span className="font-semibold text-zinc-400">BASE URL</span>
            <code className="font-medium text-indigo-600">{origin}/api/v1</code>
          </div>
        </div>
      </div>

      {/* Body: sticky sidebar + content */}
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-10">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-24">
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              On this page
            </div>
            <Anchor
              affix={false}
              offsetTop={88}
              items={NAV.map((n) => ({ key: n.key, href: `#${n.key}`, title: n.title }))}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Section id="overview" title="Overview">
            <Paragraph className="!text-[15px] !text-zinc-600">
              The Slyde HQ API is <b>asynchronous</b>: you start a generation, then
              poll until it completes. Generation takes ~30–60s. Requires a{" "}
              <b>Pro</b> plan and an API key. All requests are JSON over HTTPS.
            </Paragraph>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Create a key", d: "Settings → API keys (Pro)" },
                { n: "2", t: "POST a generation", d: "Get a generationId back" },
                { n: "3", t: "Poll for the deck", d: "URL + exports when done" },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-zinc-200 p-4">
                  <div className="mb-1 grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-[13px] font-bold text-white">
                    {s.n}
                  </div>
                  <div className="font-semibold text-zinc-900">{s.t}</div>
                  <div className="text-[13px] text-zinc-500">{s.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="auth" title="Authentication">
            <Paragraph className="!text-[15px] !text-zinc-600">
              Pass your secret key as a Bearer token on every request. Create keys in{" "}
              <a className="text-indigo-600" onClick={() => navigate("/settings/api-keys")}>
                Settings → API keys
              </a>
              . Keep keys server-side — never ship them in a browser app.
            </Paragraph>
            <Code lang="http">{`Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx`}</Code>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <KeyOutlined className="mt-0.5" />
              <span>
                A key is shown <b>once</b> at creation. Store it securely — you can't
                retrieve it again, only revoke and replace it.
              </span>
            </div>
          </Section>

          <Section id="generate" title="Create a generation">
            <Endpoint method="POST" path="/v1/generations" />
            <Paragraph className="!text-zinc-600">
              Starts a deck and returns a <Text code>generationId</Text> immediately.
              Credits are charged up front (refunded automatically if it fails).
            </Paragraph>
            <Descriptions
              bordered
              size="small"
              column={1}
              className="!mb-2"
              labelStyle={{ width: 160, fontFamily: "monospace", fontSize: 12.5 }}
              items={[
                { key: "prompt", label: "prompt", children: "string · required. What to create." },
                { key: "noOfSlides", label: "noOfSlides", children: "number · 5–21 (default 12)." },
                { key: "deckType", label: "deckType", children: "pitch_deck | proposal | general | …" },
                { key: "theme", label: "theme", children: "corporate | funky | minimal | academic" },
                { key: "canvas", label: "canvas", children: "widescreen_16_9 | square_1_1 | vertical_9_16" },
                { key: "accentColor", label: "accentColor", children: "blue | green | purple | … (optional)" },
                { key: "exports", label: "exports", children: "array of pdf | pptx | png (optional)" },
                { key: "includeSlides", label: "includeSlides", children: "boolean · include full slide JSON in the result" },
              ]}
            />
            <MultiCode
              samples={[
                {
                  lang: "cURL",
                  code: `curl -X POST ${origin}/api/v1/generations \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A pitch deck for an AI note-taking app",
    "noOfSlides": 12,
    "deckType": "pitch_deck",
    "theme": "corporate",
    "exports": ["pdf"]
  }'`,
                },
                {
                  lang: "JavaScript",
                  code: `const res = await fetch("${origin}/api/v1/generations", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_live_xxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "A pitch deck for an AI note-taking app",
    noOfSlides: 12,
    deckType: "pitch_deck",
    theme: "corporate",
    exports: ["pdf"],
  }),
});
const { generationId } = (await res.json()).data;`,
                },
                {
                  lang: "Python",
                  code: `import requests

res = requests.post(
    "${origin}/api/v1/generations",
    headers={"Authorization": "Bearer sk_live_xxx"},
    json={
        "prompt": "A pitch deck for an AI note-taking app",
        "noOfSlides": 12,
        "deckType": "pitch_deck",
        "theme": "corporate",
        "exports": ["pdf"],
    },
)
generation_id = res.json()["data"]["generationId"]`,
                },
              ]}
            />
            <Text type="secondary" className="!text-[13px]">Response · 201</Text>
            <Code lang="json">{`{ "generationId": "65f1a2…", "status": "pending" }`}</Code>
          </Section>

          <Section id="poll" title="Poll status">
            <Endpoint method="GET" path="/v1/generations/:id" />
            <Paragraph className="!text-zinc-600">
              Poll about once per second until <Text code>status</Text> is{" "}
              <Tag color="green" className="!m-0">completed</Tag> or{" "}
              <Tag color="red" className="!m-0">failed</Tag>.
            </Paragraph>
            <MultiCode
              samples={[
                {
                  lang: "cURL",
                  code: `curl ${origin}/api/v1/generations/65f1a2… \\
  -H "Authorization: Bearer sk_live_xxx"`,
                },
                {
                  lang: "JavaScript",
                  code: `// poll until done
let job;
do {
  await new Promise((r) => setTimeout(r, 1500));
  const res = await fetch(
    "${origin}/api/v1/generations/" + generationId,
    { headers: { Authorization: "Bearer sk_live_xxx" } },
  );
  job = (await res.json()).data;
} while (job.status === "pending" || job.status === "processing");
console.log(job.url, job.exports);`,
                },
                {
                  lang: "Python",
                  code: `import time, requests

while True:
    res = requests.get(
        f"${origin}/api/v1/generations/{generation_id}",
        headers={"Authorization": "Bearer sk_live_xxx"},
    )
    job = res.json()["data"]
    if job["status"] in ("completed", "failed"):
        break
    time.sleep(1.5)

print(job.get("url"), job.get("exports"))`,
                },
              ]}
            />
            <Text type="secondary" className="!text-[13px]">Response · completed</Text>
            <Code lang="json">{`{
  "generationId": "65f1a2…",
  "status": "completed",
  "deckId": "65a9c0…",
  "url": "${origin}/share/AbC123",
  "exports": { "pdf": "https://cdn.slydehq.com/…/deck.pdf" }
}`}</Code>
          </Section>

          <Section id="credits" title="Check credits">
            <Endpoint method="GET" path="/v1/credits" />
            <Paragraph className="!text-zinc-600">
              Your workspace balance and this key's budget. A deck's cost scales with
              its length: <Text code>base + perSlide × slides</Text> credits.
            </Paragraph>
            <Code lang="json">{`{
  "balance": 1800,
  "keyBudget": 5000,
  "keySpent": 600,
  "keyRemaining": 4400,
  "deckPricing": {
    "base": 30,
    "perSlide": 8,
    "example": { "slides": 10, "credits": 110 }
  }
}`}</Code>
          </Section>

          <Section id="errors" title="Errors">
            <Paragraph className="!text-zinc-600">
              Errors return <Text code>{`{ "message": "…" }`}</Text> with a standard
              HTTP status.
            </Paragraph>
            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: 90, fontWeight: 600 }}
              items={[
                { key: "401", label: "401", children: "Missing or invalid API key." },
                { key: "402", label: "402", children: "Insufficient credits, or the key's budget is exhausted." },
                { key: "403", label: "403", children: "Workspace is not on the Pro plan." },
                { key: "422", label: "422", children: "Invalid request body." },
                { key: "429", label: "429", children: "Rate limit exceeded — see the Retry-After header." },
                { key: "404", label: "404", children: "Unknown generation or deck." },
              ]}
            />
          </Section>

          <Section id="limits" title="Rate limits">
            <Paragraph className="!text-zinc-600">Limits are per API key:</Paragraph>
            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: 240, fontFamily: "monospace", fontSize: 12.5 }}
              items={[
                { key: "g", label: "POST /v1/generations", children: "20 / minute · 200 / hour" },
                { key: "s", label: "GET /v1/generations/:id", children: "60 / minute" },
              ]}
            />
            <Paragraph type="secondary" className="!mt-3 !text-[13px]">
              On <Text code>429</Text>, back off for the seconds given in the{" "}
              <Text code>Retry-After</Text> header before retrying.
            </Paragraph>
          </Section>

          {/* Footer CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 px-6 py-5">
            <div>
              <div className="text-[15px] font-semibold text-zinc-900">
                Ready to build?
              </div>
              <div className="text-[13px] text-zinc-500">
                Create a Pro API key and make your first deck in minutes.
              </div>
            </div>
            <Button type="primary" size="large" onClick={() => navigate("/settings/api-keys")}>
              Get your API key
            </Button>
          </div>
          <div className="h-12" />
        </main>
      </div>
    </div>
  );
};

export default ApiDocsPage;
