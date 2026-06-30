/**
 * Images shown in the 3D marquee on the auth screens' brand panel (login, signup,
 * invite). Sourced from `public/slider/*.webp`. We have a handful of slides, so we
 * repeat them — rotating the order on each pass — to fill the marquee's 4 columns
 * without the columns lining up identically.
 */
const SLIDES = Array.from({ length: 7 }, (_, i) => `/slider/${i + 1}.webp`);

export const loginMarqueeImages = Array.from({ length: 5 }, (_, copy) =>
  SLIDES.map((_, i) => SLIDES[(i + copy * 3) % SLIDES.length]!),
).flat();
