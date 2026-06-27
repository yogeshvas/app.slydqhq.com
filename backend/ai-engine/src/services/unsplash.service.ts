import axios from "axios";
import { sanitizeImageQuery } from "./imageQurtyOptimier";

// Substrings that mark a photo as wildly off-domain for a B2B proposal deck.
// Best-effort secondary net: Unsplash's /search/photos rarely returns `tags`,
// so this mostly matches against alt_description/description. The primary defense
// is the banned-words sanitizer, which strips the triggers ("pain", "leakage")
// before they ever reach Unsplash; this catches obvious leftovers (skin, food,
// animals) so images don't "deviate from the project".
const OFF_DOMAIN = [
    // body / beauty / medical close-ups (the dermatology-hands bug)
    "skin", "body", "massage", "spa", "cosmetic", "beauty", "cream", "lotion",
    "facial", "dermat", "tattoo", "makeup", "manicure", "nail", "salon",
    "wound", "injury", "blood", "surgery", "medic", "muscle", "naked", "nude",
    "feet", "foot", "leg", "thigh", "shoulder", "massaging",
    // food & drink
    "food", "meal", "dish", "recipe", "restaurant", "kitchen", "cooking",
    "fruit", "vegetable", "dessert", "cake", "coffee bean",
    // nature / animals / leisure
    "animal", "dog", "cat", "pet", "wildlife", "bird", "insect", "flower",
    "plant", "garden", "forest", "beach", "mountain", "ocean", "sunset",
    "wedding", "bride", "religion", "church", "sport", "gym", "workout",
    "yoga", "fitness", "baby", "toddler", "child", "kid",
];

// Neutral, always-safe business queries used when the primary search returns
// nothing acceptable.
const SAFE_FALLBACKS = [
    "modern office workspace",
    "business team meeting",
    "professional working laptop",
    "corporate technology",
];

function isOffDomain(photo: any): boolean {
    const tagText = Array.isArray(photo?.tags)
        ? photo.tags.map((t: any) => t?.title ?? "").join(" ")
        : "";
    const haystack = [photo?.alt_description, photo?.description, tagText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (!haystack) return false; // no metadata — don't reject on a hunch
    return OFF_DOMAIN.some(bad => haystack.includes(bad));
}

async function searchUnsplash(query: string, orientation: string): Promise<any[]> {
    const response = await axios.get("https://api.unsplash.com/search/photos", {
        params: {
            query,
            per_page: 30,
            // Always take the most relevant page. Variety comes from the
            // usedUrls de-dupe + the 30-result pool, not from random paging,
            // which previously pushed results far away from the query intent.
            page: 1,
            orientation,
            order_by: "relevant",
            content_filter: "high",
        },
        headers: {
            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY?.trim()}`,
        },
    });
    return response.data?.results ?? [];
}

function pickFresh(results: any[], usedUrls: Set<string>): string | null {
    // Prefer fresh + on-domain, then fresh, then anything.
    const onDomain = results.filter(r => !isOffDomain(r));
    const freshOnDomain = onDomain.find(r => !usedUrls.has(r.urls.regular));
    if (freshOnDomain) return freshOnDomain.urls.regular;
    if (onDomain.length) return onDomain[0].urls.regular;
    return null; // everything was off-domain — let caller try a fallback query
}

export const getUnsplashImage = async (
    query: string,
    orientation: string = "landscape",
    usedUrls: Set<string> = new Set()
): Promise<string | null> => {
    try {
        const safeQuery = sanitizeImageQuery(query);
        const safeOrientation = orientation === "square" ? "squarish" : orientation;

        console.log("Searching:", safeQuery);

        let results = await searchUnsplash(safeQuery, safeOrientation);
        console.log("Unsplash results:", results.length);

        let pick = results.length ? pickFresh(results, usedUrls) : null;

        // Primary query produced nothing on-domain — fall back to a guaranteed
        // business-relevant query so the slide never gets an off-topic photo.
        if (!pick) {
            const fallback = SAFE_FALLBACKS[Math.floor(Math.random() * SAFE_FALLBACKS.length)]!;
            console.log("No on-domain image for:", safeQuery, "→ fallback:", fallback);
            results = await searchUnsplash(fallback, safeOrientation);
            pick = results.length ? pickFresh(results, usedUrls) : null;
        }

        if (!pick) {
            console.log("No image found:", safeQuery);
            return null;
        }

        return pick;
    } catch (error: any) {
        console.log("Unsplash error:", error?.response?.data || error.message);
        return null;
    }
};
