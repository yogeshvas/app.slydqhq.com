import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts (used by ui/ components). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact relative time, e.g. "26 seconds ago", "7 hours ago", "3 months ago". */
export function timeAgo(input?: string | number | Date | null): string {
  if (!input) return "";
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 5) return "just now";
  const units: [limit: number, div: number, name: string][] = [
    [60, 1, "second"],
    [3600, 60, "minute"],
    [86400, 3600, "hour"],
    [604800, 86400, "day"],
    [2629800, 604800, "week"],
    [31557600, 2629800, "month"],
    [Infinity, 31557600, "year"],
  ];
  for (const [limit, div, name] of units) {
    if (secs < limit) {
      const n = Math.floor(secs / div);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "";
}
