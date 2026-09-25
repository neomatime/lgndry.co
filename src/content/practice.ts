// The three service areas on the Practice page.
//
// Seeded from the live `practice` table on 2026-09-25; it matched the page's
// original HTML exactly. The legacy site loaded the lists at runtime and
// replaced the HTML with them, so if you edit a list, edit it here.

export const PHOTOGRAPHY = {
  number: "01",
  name: "Photography",
  tag: "Brand, Commercial & Fine Art",
  description: "Considered photography that reveals character, emotion and place.",
  items: [
    "Brand Photography",
    "Commercial Photography",
    "Portraiture",
    "Product Photography",
    "Executive Portraiture",
    "Interior & Architectural Photography",
    "Hospitality Photography",
    "Fine Art Photography",
  ],
} as const;

export const VISUAL_COMMUNICATION = {
  number: "02",
  name: "Visual Communication",
  tag: "Storytelling & Direction",
  description: "Strategic image-making that gives a brand one coherent visual voice.",
  items: [
    "Brand Storytelling",
    "Creative Direction",
    "Campaign Development",
    "Editorial Production",
    "Visual Identity Systems",
  ],
} as const;

export const BRAND_PARTNERSHIPS = {
  number: "03",
  name: "Brand Partnerships",
  tag: "Ongoing Content Partnerships",
  description: "Consistent, high-quality visual content that grows your brand over time.",
  items: [
    "Creative Partnerships",
    "Visual Content Partnerships",
    "Campaign Production",
    "Dedicated Visual Partner",
  ],
} as const;

export type ServiceArea = {
  number: string;
  name: string;
  tag: string;
  description: string;
  items: readonly string[];
};
