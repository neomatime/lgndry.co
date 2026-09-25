import type { Artwork } from "@/features/shop/catalogue/artwork";

export type SortKey = "featured" | "newest" | "price-low" | "price-high" | "popular";

export type CatalogueFilters = {
  search: string;
  category: string;
  collection: string;
  artist: string;
  availability: string;
  /** Raw text of the price boxes; empty means no bound. */
  min: string;
  max: string;
  sort: SortKey;
};

export const NO_FILTERS: CatalogueFilters = {
  search: "",
  category: "",
  collection: "",
  artist: "",
  availability: "",
  min: "",
  max: "",
  sort: "featured",
};

/** The distinct, non-empty values of a text field, sorted. */
export function distinctValues(
  products: Artwork[],
  field: "category" | "collectionName" | "artist",
): string[] {
  return [...new Set(products.map((p) => p[field]).filter(Boolean))].sort();
}

/** Filters, then sorts, exactly as the legacy catalogue did. */
export function filterAndSort(products: Artwork[], filters: CatalogueFilters): Artwork[] {
  const search = filters.search.trim().toLowerCase();
  const min = Number(filters.min || 0);
  const max = Number(filters.max || Infinity);

  const matching = products.filter((p) => {
    const haystack = [p.title, p.artist, p.category, p.collectionName].join(" ").toLowerCase();
    return (
      (!search || haystack.includes(search)) &&
      (!filters.category || p.category === filters.category) &&
      (!filters.collection || p.collectionName === filters.collection) &&
      (!filters.artist || p.artist === filters.artist) &&
      (!filters.availability || p.availability === filters.availability) &&
      p.price >= min &&
      p.price <= max
    );
  });

  return matching.sort((a, b) => {
    switch (filters.sort) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "popular":
        return b.popularity - a.popularity;
      case "newest":
        return String(b.publishedAt || b.year || "").localeCompare(
          String(a.publishedAt || a.year || ""),
        );
      default:
        return Number(b.featured) - Number(a.featured) || a.position - b.position;
    }
  });
}
