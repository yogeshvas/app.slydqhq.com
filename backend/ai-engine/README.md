# AI Presentation Generator

Generate beautiful, professional presentation decks from a single plain-English prompt. The AI figures out the type, structure, layouts, and content automatically.

## Setup

```bash
bun install
```

Create a `.env` file:

```env
OPEN_AI_KEY=your_openai_api_key
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

## Run

```bash
bun run src/index.ts
```

Server starts at `http://localhost:3000`.

---

## API Reference

### `POST /generate`

Generate a presentation from a plain-English prompt.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | **Yes** | Natural language description of what you want |
| `noOfSlides` | number | No | Number of slides (default: 15, min: 5, max: 21) |

**Example request:**

```json
{
  "prompt": "Create a pitch deck for my AI startup that helps doctors detect cancer earlier using MRI scans. We have 3 pilot hospitals, 94% accuracy, and are raising $5M Series A.",
  "noOfSlides": 13
}
```

**Example response:**

```json
{
  "deckTitle": "Saving Lives Earlier: The AI Diagnostic Platform Redefining Cancer Detection",
  "storyTheme": "How one startup is turning MRI data into earlier diagnoses and better outcomes",
  "pdfPath": "/path/to/generated/1749123456789.pdf",
  "aiImages": ["http://localhost:3000/images/cover_xyz.png"],
  "slides": [ ... ]
}
```

---

### What the AI infers from your prompt

You don't need to specify any of these — the AI figures them out:

| What | How it's inferred |
|---|---|
| Presentation type | From the intent of the prompt |
| Audience | From context clues in the prompt |
| Tone | From the subject matter and phrasing |
| Key points | Extracted or inferred from the topic |
| Narrative arc | Matched to the presentation type |
| Slide layouts | Chosen per slide for maximum visual impact |

---

### Prompt examples

**Pitch deck**
```json
{
  "prompt": "Pitch deck for ChainIQ, an AI supply chain platform. $2.4T market, 3.2x ROI proven with 3 customers, raising $5M.",
  "noOfSlides": 12
}
```

**Training / Workshop**
```json
{
  "prompt": "Training on machine learning basics for non-technical marketing teams at Spotify. Cover: what ML is, how recommendations work, how to brief data teams.",
  "noOfSlides": 10
}
```

**Product launch**
```json
{
  "prompt": "Launch presentation for DataSense 2.0 at our annual summit. New features: natural language queries, 200+ connectors, Slack alerts, SOC 2 compliance.",
  "noOfSlides": 14
}
```

**Keynote**
```json
{
  "prompt": "Keynote about the future of work and AI for FutureTech Summit 2026, 2000 attendees. Main message: AI augments humans, it doesn't replace them.",
  "noOfSlides": 12
}
```

**Research report**
```json
{
  "prompt": "Present our research findings: State of AI in Healthcare 2026. 800 hospitals surveyed, 67% adopted AI diagnostics, top barrier is data privacy.",
  "noOfSlides": 14
}
```

**Executive briefing / business case**
```json
{
  "prompt": "Board presentation for GlobalBank asking approval for a $2.8M cloud migration to AWS. Current infra costs $4.2M/year and is 8 years old. Projected 40% savings after 24 months.",
  "noOfSlides": 10
}
```

**Company overview**
```json
{
  "prompt": "Company overview deck for NovaTech to share with new enterprise partners. $120M ARR, 420 employees, 98% retention, top 3 global banks as clients.",
  "noOfSlides": 10
}
```

---

### `GET /health`

Health check.

```json
{ "success": true, "message": "status is healthy" }
```

---

### `GET /images`

List all AI-generated cover images saved on disk.

```json
{
  "count": 4,
  "images": [
    {
      "fileName": "1749123456_cover.png",
      "url": "/images/1749123456_cover.png",
      "createdAt": "1749123456"
    }
  ]
}
```

---

### `GET /test-unsplash`

Verify your Unsplash API key is working.

---

### `GET /test-dalle`

Verify your OpenAI key has DALL-E access and billing is active.

---

## How it works

```
User prompt
    │
    ▼
Presentation Strategist (GPT)
  → detects type, audience, tone
  → picks narrative arc
  → designs slide blueprint
    │
    ▼
Layout Selector Agent (GPT)
  → assigns optimal visual layout to each slide
  → enforces variety (32 layouts available)
    │
    ▼
Slide Content Agent (GPT) — runs in parallel per slide
  → writes title, bullets, metrics, flow nodes, charts
  → tailored to the topic and audience
    │
    ▼
Image fetching — parallel
  → 2 AI illustrations (DALL-E) for cover + first image slide
  → Unsplash stock photos for remaining image slides
    │
    ▼
PDF renderer (Puppeteer)
  → renders all 32 layout types to HTML
  → outputs 13.33" × 7.5" PDF
```

## Available layouts (32)

| Category | Layouts |
|---|---|
| Hero / Image | `hero`, `image_left`, `image_right`, `quote_image` |
| Text + Data | `text_flow`, `text_chart`, `two_column`, `metrics`, `minimal` |
| Big Impact | `big_numbers`, `split_insight`, `dark_flow`, `dark_comparison`, `dark_steps` |
| Grid | `challenge_grid`, `icon_grid`, `flow_kpi`, `numbered_steps_callout` |
| Diagrams | `process_donut`, `staggered_phases`, `concentric_layers`, `tech_ecosystem`, `timeline`, `architecture`, `comparison` |
| Flow & Visual | `funnel_stages`, `arrow_pipeline`, `pyramid_tiers`, `circular_flow`, `venn_overlap`, `petal_diagram` |

## Import into Bruno / Postman

Import `ai-presentation-generator.postman_collection.json` from the project root.
Compatible with both Bruno and Postman (v2.1 format).
