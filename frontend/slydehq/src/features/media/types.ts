/** A workspace media-library item (mirrors the core Asset model). */
export type MediaSource = "ai" | "unsplash" | "upload";

export interface MediaItem {
  _id: string;
  url: string;
  source: MediaSource | "export";
  title: string;
  description: string;
  tags: string[];
  aiTags: string[];
  metaStatus: "pending" | "ready" | "failed";
  width?: number;
  height?: number;
  bytes?: number;
  mime?: string;
  originalFilename?: string;
  meta?: { prompt?: string; unsplashId?: string };
  createdAt: string;
}

export interface MediaListResult {
  items: MediaItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface MediaFilters {
  source?: MediaSource;
  q?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

/** The library tabs. `all` maps to no `source` filter. */
export type MediaTab = "all" | MediaSource;
