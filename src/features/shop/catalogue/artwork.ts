/** One work in the collection, as the shop pages use it. */
export type Artwork = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  category: string;
  collectionName: string;
  description: string;
  /** Main image exactly as stored: a site path ("assests/…") or a full URL. */
  image: string;
  /** Every image, main one included when nothing else is listed. Same format as `image`. */
  imageList: string[];
  price: number;
  editionSize: number;
  remaining: number;
  availability: string;
  seriesLabel: string;
  medium: string;
  /** Free text; also the source of the size list when `sizes` is empty. */
  dimensions: string;
  /** One size per line. */
  sizes: string;
  /** One presentation option per line. */
  framingOptions: string;
  deliveryEstimate: string;
  featured: boolean;
  popularity: number;
  position: number;
  requiresConfirmation: boolean;
  publishedAt: string;
};

const DEFAULT_ARTIST = "Dan Mokgwadi";
const DEFAULT_MEDIUM = "Archival Pigment Print";
const DEFAULT_DELIVERY = "7-14 business days after payment confirmation";

/** Non-empty trimmed lines of a multi-line text field. */
export function lines(value: unknown): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const text = (value: unknown) => (value == null ? "" : String(value));
const number = (value: unknown) => Number(value || 0);

/**
 * Turns a `collection` table row into an Artwork, applying the same defaults
 * the legacy catalogue and showroom scripts applied to missing values.
 */
export function artworkFromRow(row: Record<string, unknown>): Artwork {
  const category = text(row.category);
  const image = text(row.image);
  const extraImages = lines(row.images);
  return {
    id: text(row.id),
    title: text(row.title),
    artist: text(row.artist) || DEFAULT_ARTIST,
    year: row.year == null || row.year === "" ? null : Number(row.year),
    category,
    collectionName:
      text(row.collectionName) ||
      (category === "Studio Art" ? "Studio Art" : "Found Beauty in the Mundane"),
    description: text(row.description),
    image,
    imageList: extraImages.length ? extraImages : [image],
    price: number(row.price),
    editionSize: number(row.editionSize),
    remaining: number(row.remaining),
    availability: text(row.availability),
    seriesLabel: text(row.seriesLabel),
    medium: text(row.medium) || text(row.seriesLabel) || DEFAULT_MEDIUM,
    dimensions: text(row.dimensions) || text(row.sizes),
    sizes: text(row.sizes),
    framingOptions: text(row.framingOptions),
    deliveryEstimate: text(row.deliveryEstimate) || DEFAULT_DELIVERY,
    featured: Boolean(row.featured),
    popularity: number(row.popularity),
    position: number(row.position),
    requiresConfirmation: Boolean(row.requiresConfirmation),
    publishedAt: text(row.publishedAt),
  };
}

/**
 * The URL to load an image from. Rows written by the old admin hold either a
 * full storage URL or a path relative to the site root ("assests/images/…").
 */
export function imageSrc(path: string): string {
  if (!path) return "";
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("/") || path.startsWith("data:"))
    return path;
  return `/${path}`;
}

/** Sizes a visitor can pick from; a single stand-in when none are listed. */
export function sizeOptions(product: Pick<Artwork, "sizes" | "dimensions">): string[] {
  const sizes = lines(product.sizes);
  return sizes.length ? sizes : [product.dimensions || "Standard edition"];
}

/** Whether the work can be added straight to the cart. */
export function isAvailable(product: Pick<Artwork, "availability" | "remaining">): boolean {
  return product.availability === "Available" && product.remaining > 0;
}

/** "Edition of 15 · 6 available", or the series label, or "Open edition". */
export function editionLabel(
  product: Pick<Artwork, "editionSize" | "remaining" | "seriesLabel">,
  separator = " · ",
): string {
  return product.editionSize
    ? `Edition of ${product.editionSize}${separator}${product.remaining} available`
    : product.seriesLabel || "Open edition";
}
