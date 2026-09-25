/** A room photograph the artwork can be previewed in. */
export type Space = {
  id: string;
  name: string;
  style: string;
  image: string;
  /** Rough width of the visible wall in cm, used to scale the print. */
  wallWidth: number;
  /** Where the print hangs, as a percentage from the top of the photo. */
  y: number;
  /** Tallest the print may be, as a fraction of the photo's height. */
  maxHeight: number;
};

export const SPACES: readonly Space[] = [
  {
    id: "living",
    name: "Living Room",
    style: "Modern Interior",
    image: "/assests/images/curated-spaces/living-room.webp",
    wallWidth: 360,
    y: 30,
    maxHeight: 0.38,
  },
  {
    id: "hallway",
    name: "Hallway",
    style: "Scandinavian",
    image: "/assests/images/curated-spaces/hallway.webp",
    wallWidth: 300,
    y: 32,
    maxHeight: 0.42,
  },
  {
    id: "bedroom",
    name: "Bedroom",
    style: "Minimal & Warm",
    image: "/assests/images/curated-spaces/bedroom.webp",
    wallWidth: 340,
    y: 27,
    maxHeight: 0.34,
  },
  {
    id: "office",
    name: "Office",
    style: "Executive Suite",
    image: "/assests/images/curated-spaces/office.webp",
    wallWidth: 320,
    y: 31,
    maxHeight: 0.38,
  },
  {
    id: "dining",
    name: "Dining Room",
    style: "Contemporary",
    image: "/assests/images/curated-spaces/dining-room.webp",
    wallWidth: 360,
    y: 36,
    maxHeight: 0.36,
  },
];

export const FRAMES = ["Unframed", "Oak Frame", "Black Frame", "White Frame"] as const;

/** Pixel size of the original image file, once it has loaded. */
export type NaturalSize = { width: number; height: number };

/**
 * The print's real-world width and height in cm, read from a size label such
 * as "50 × 70 cm" or "135.1x90cm" and turned to match the photograph's
 * orientation. Labels with no two numbers ("Standard edition") get a stand-in.
 */
export function printSize(
  label: string,
  natural: NaturalSize | null,
): { width: number; height: number } {
  const numbers = String(label || "")
    .replace(/,/g, ".")
    .match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) return { width: 100, height: 67 };
  const a = Number(numbers[0]);
  const b = Number(numbers[1]);
  const sourceRatio = natural ? natural.width / natural.height : 1.5;
  const landscape = sourceRatio >= 0.9;
  return landscape
    ? { width: Math.max(a, b), height: Math.min(a, b) }
    : { width: Math.min(a, b), height: Math.max(a, b) };
}

/**
 * How big, and with what proportions, the artwork is drawn in a room photo.
 * `sceneRatio` is the photo's own width ÷ height (the big preview is 3:2, the
 * small cards 4:3). The print is scaled against the wall width but never
 * bigger than the room's height allowance or 75% of the photo.
 */
export function placement(
  room: Space,
  sceneRatio: number,
  size: string,
  natural: NaturalSize | null,
): { scale: string; ratio: string } {
  const print = printSize(size, natural);
  const ratio = natural ? natural.width / natural.height : print.width / print.height;
  const maxScale = (room.maxHeight * ratio) / sceneRatio;
  const scale = Math.max(0.1, Math.min(0.75, print.width / room.wallWidth, maxScale));
  return { scale: scale.toFixed(3), ratio: ratio.toFixed(4) };
}

/** "Oak Frame" → "oak", the value the stylesheet keys its frame looks on. */
export function frameKey(frame: string): string {
  return frame.toLowerCase().split(" ")[0] ?? "";
}
