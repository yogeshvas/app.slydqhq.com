/**
 * Tiny wireframe "sketch" of a layout's structure, for the layout picker.
 * Each engine layout maps to a schematic `kind`; we draw a simple grayscale
 * mockup (image blocks tinted indigo) so users can see the shape at a glance.
 */

const KIND: Record<string, string> = {
  minimal: "minimal",
  two_column: "two-col",
  text_flow: "text-flow",
  text_chart: "text-chart",
  metrics: "metrics",
  big_numbers: "big-numbers",
  hero: "image-left",
  image_left: "image-left",
  image_right: "image-right",
  quote_image: "quote-image",
  split_insight: "split",
  dark_comparison: "table",
  comparison: "table",
  dark_steps: "grid2x2",
  numbered_steps_callout: "grid2x2",
  dark_flow: "flow",
  arrow_pipeline: "flow",
  circular_flow: "flow",
  icon_grid: "grid3",
  challenge_grid: "grid3",
  tech_ecosystem: "diagram",
  architecture: "diagram",
  auto_diagram: "diagram",
  petal_diagram: "diagram",
  flow_kpi: "flow-kpi",
  process_donut: "donut",
  concentric_layers: "donut",
  staggered_phases: "timeline",
  timeline: "timeline",
  funnel_stages: "funnel",
  pyramid_tiers: "pyramid",
  venn_overlap: "venn",
  social_statement: "social",
  social_quote: "social",
  social_cta: "social",
  social_stat: "big-numbers",
  social_list_card: "list",
};

const Bar = ({ w = "100%", h = 6 }: { w?: string; h?: number }) => (
  <div style={{ width: w, height: h }} className="rounded-sm bg-zinc-300" />
);
const Img = ({ className = "" }: { className?: string }) => (
  <div className={`rounded bg-indigo-200 ${className}`} />
);
const Block = ({ className = "" }: { className?: string }) => (
  <div className={`rounded bg-zinc-200 ${className}`} />
);

function Sketch({ kind }: { kind: string }) {
  switch (kind) {
    case "image-left":
      return (
        <div className="flex h-full gap-2">
          <Img className="h-full w-1/2" />
          <div className="flex w-1/2 flex-col justify-center gap-1.5">
            <Bar w="80%" h={8} />
            <Bar w="60%" />
            <Bar w="70%" />
          </div>
        </div>
      );
    case "image-right":
      return (
        <div className="flex h-full gap-2">
          <div className="flex w-1/2 flex-col justify-center gap-1.5">
            <Bar w="80%" h={8} />
            <Bar w="60%" />
            <Bar w="70%" />
          </div>
          <Img className="h-full w-1/2" />
        </div>
      );
    case "quote-image":
      return (
        <div className="flex h-full gap-2">
          <div className="flex w-1/2 flex-col justify-center gap-1.5">
            <Bar w="90%" h={8} />
            <Bar w="80%" h={8} />
            <Bar w="40%" />
          </div>
          <Img className="h-full w-1/2" />
        </div>
      );
    case "two-col":
      return (
        <div className="flex h-full flex-col gap-1.5">
          <Bar w="50%" h={8} />
          <div className="flex flex-1 gap-2">
            <Block className="flex-1" />
            <Block className="flex-1" />
          </div>
        </div>
      );
    case "text-flow":
      return (
        <div className="flex h-full items-center gap-2">
          <div className="flex w-1/2 flex-col gap-1.5">
            <Bar w="80%" /> <Bar w="60%" /> <Bar w="70%" />
          </div>
          <div className="flex w-1/2 items-center justify-between">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-5 w-5 rounded-full bg-indigo-200" />
            ))}
          </div>
        </div>
      );
    case "text-chart":
      return (
        <div className="flex h-full items-end gap-2">
          <div className="flex w-1/2 flex-col gap-1.5 self-center">
            <Bar w="80%" /> <Bar w="60%" />
          </div>
          <div className="flex h-full w-1/2 items-end gap-1.5">
            {[40, 70, 55, 90].map((h, i) => (
              <div key={i} style={{ height: `${h}%` }} className="flex-1 rounded-sm bg-indigo-200" />
            ))}
          </div>
        </div>
      );
    case "metrics":
      return (
        <div className="flex h-full items-center justify-around">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-5 w-8 rounded bg-zinc-300" />
              <Bar w="30px" h={4} />
            </div>
          ))}
        </div>
      );
    case "big-numbers":
      return (
        <div className="flex h-full items-center justify-around">
          {[0, 1].map((i) => (
            <div key={i} className="h-8 w-12 rounded bg-zinc-300" />
          ))}
        </div>
      );
    case "minimal":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <Bar w="60%" h={10} />
          <Bar w="40%" />
        </div>
      );
    case "split":
      return (
        <div className="flex h-full gap-2">
          <Block className="h-full flex-1 !bg-zinc-700" />
          <Block className="h-full flex-1" />
        </div>
      );
    case "table":
      return (
        <div className="flex h-full flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 gap-2">
              <Block className="flex-1" />
              <Block className="flex-1" />
            </div>
          ))}
        </div>
      );
    case "grid2x2":
      return (
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} />
          ))}
        </div>
      );
    case "grid3":
      return (
        <div className="grid h-full grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} />
          ))}
        </div>
      );
    case "flow":
      return (
        <div className="flex h-full items-center justify-between px-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-6 rounded-full bg-indigo-200" />
          ))}
        </div>
      );
    case "flow-kpi":
      return (
        <div className="flex h-full flex-col justify-between gap-2">
          <div className="flex items-center justify-between px-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-5 w-5 rounded-full bg-indigo-200" />
            ))}
          </div>
          <div className="flex justify-around">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 w-7 rounded bg-zinc-300" />
            ))}
          </div>
        </div>
      );
    case "donut":
      return (
        <div className="grid h-full place-items-center">
          <div className="h-12 w-12 rounded-full border-[5px] border-indigo-200" />
        </div>
      );
    case "timeline":
      return (
        <div className="flex h-full items-center gap-2 px-1">
          <div className="h-0.5 flex-1 bg-zinc-300" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 w-4 rounded-full bg-indigo-200" />
          ))}
          <div className="h-0.5 flex-1 bg-zinc-300" />
        </div>
      );
    case "funnel":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1">
          {[90, 70, 50, 30].map((w, i) => (
            <div key={i} style={{ width: `${w}%` }} className="h-3 rounded-sm bg-indigo-200" />
          ))}
        </div>
      );
    case "pyramid":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1">
          {[30, 60, 90].map((w, i) => (
            <div key={i} style={{ width: `${w}%` }} className="h-3.5 rounded-sm bg-indigo-200" />
          ))}
        </div>
      );
    case "venn":
      return (
        <div className="grid h-full place-items-center">
          <div className="flex">
            <div className="h-10 w-10 rounded-full bg-indigo-200/70" />
            <div className="-ml-4 h-10 w-10 rounded-full bg-zinc-300/70" />
          </div>
        </div>
      );
    case "diagram":
      return (
        <div className="relative h-full">
          <div className="absolute left-1/2 top-1 h-4 w-6 -translate-x-1/2 rounded bg-indigo-200" />
          <div className="absolute bottom-1 left-2 h-4 w-6 rounded bg-zinc-300" />
          <div className="absolute bottom-1 right-2 h-4 w-6 rounded bg-zinc-300" />
          <div className="absolute left-1/2 top-6 h-3 w-px -translate-x-1/2 bg-zinc-300" />
        </div>
      );
    case "list":
      return (
        <div className="flex h-full flex-col justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-indigo-200" />
              <Bar w="70%" />
            </div>
          ))}
        </div>
      );
    case "social":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <Bar w="70%" h={10} />
          <Bar w="50%" h={10} />
        </div>
      );
    default:
      return (
        <div className="flex h-full flex-col justify-center gap-1.5">
          <Bar w="70%" h={8} /> <Bar w="50%" /> <Bar w="60%" />
        </div>
      );
  }
}

export function LayoutSkeleton({ layout }: { layout: string }) {
  const kind = KIND[layout] ?? "default";
  return (
    <div className="aspect-video w-full bg-zinc-50 p-3">
      <Sketch kind={kind} />
    </div>
  );
}
