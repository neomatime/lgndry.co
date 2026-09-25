import { describe, expect, it } from "vitest";
import {
  artworkFromRow,
  editionLabel,
  imageSrc,
  isAvailable,
  lines,
  sizeOptions,
} from "@/features/shop/catalogue/artwork";
import { NO_FILTERS, distinctValues, filterAndSort } from "@/features/shop/catalogue/filter";

const row = (over: Record<string, unknown> = {}) => ({
  id: "1",
  title: "Gae",
  price: "35000.00",
  category: "Art Print",
  collectionName: "Found Beauty",
  availability: "Available",
  remaining: 6,
  editionSize: 15,
  image: "assests/images/collection/thumbs/gae.jpg",
  images: "",
  sizes: "50 × 70 cm\n60 × 90 cm\n",
  position: 5,
  featured: false,
  popularity: 0,
  year: 2025,
  publishedAt: "2026-07-01T00:00:00Z",
  ...over,
});

const art = (over: Record<string, unknown> = {}) => artworkFromRow(row(over));

describe("artworkFromRow", () => {
  it("converts numeric strings and applies the legacy defaults", () => {
    const a = artworkFromRow({ id: "x", title: "T", price: "80000.00", image: "a.jpg" });
    expect(a.price).toBe(80000);
    expect(a.artist).toBe("Dan Mokgwadi");
    expect(a.medium).toBe("Archival Pigment Print");
    expect(a.collectionName).toBe("Found Beauty in the Mundane");
    expect(a.remaining).toBe(0);
    expect(a.year).toBeNull();
    expect(a.imageList).toEqual(["a.jpg"]);
  });

  it("names studio work after its category and falls back through medium/series", () => {
    expect(artworkFromRow({ category: "Studio Art" }).collectionName).toBe("Studio Art");
    expect(artworkFromRow({ seriesLabel: "Limited series" }).medium).toBe("Limited series");
  });

  it("uses the extra-image list when there is one", () => {
    const a = art({ images: "one.jpg\n two.jpg \n\n" });
    expect(a.imageList).toEqual(["one.jpg", "two.jpg"]);
  });

  it("uses the sizes text as dimensions when none are given", () => {
    expect(art({ dimensions: "" }).dimensions).toBe("50 × 70 cm\n60 × 90 cm\n");
  });
});

describe("helpers", () => {
  it("lines drops blanks and trims", () => {
    expect(lines(" a \n\n b\n")).toEqual(["a", "b"]);
    expect(lines(null)).toEqual([]);
  });

  it("imageSrc keeps URLs and roots relative site paths", () => {
    expect(imageSrc("assests/x y.jpg")).toBe("/assests/x y.jpg");
    expect(imageSrc("https://host/a.jpg")).toBe("https://host/a.jpg");
    expect(imageSrc("/already.jpg")).toBe("/already.jpg");
    expect(imageSrc("")).toBe("");
  });

  it("sizeOptions falls back to dimensions, then a stand-in", () => {
    expect(sizeOptions({ sizes: "A\nB", dimensions: "" })).toEqual(["A", "B"]);
    expect(sizeOptions({ sizes: "", dimensions: "100 cm" })).toEqual(["100 cm"]);
    expect(sizeOptions({ sizes: "", dimensions: "" })).toEqual(["Standard edition"]);
  });

  it("isAvailable needs both the status and stock", () => {
    expect(isAvailable({ availability: "Available", remaining: 1 })).toBe(true);
    expect(isAvailable({ availability: "Available", remaining: 0 })).toBe(false);
    expect(isAvailable({ availability: "Reserved", remaining: 3 })).toBe(false);
  });

  it("editionLabel describes limited and open editions", () => {
    expect(editionLabel({ editionSize: 15, remaining: 6, seriesLabel: "" })).toBe(
      "Edition of 15 · 6 available",
    );
    expect(editionLabel({ editionSize: 0, remaining: 0, seriesLabel: "Series" })).toBe("Series");
    expect(editionLabel({ editionSize: 0, remaining: 0, seriesLabel: "" })).toBe("Open edition");
  });
});

describe("filterAndSort", () => {
  const works = [
    art({
      id: "a",
      title: "Alpha",
      price: 20000,
      position: 2,
      popularity: 1,
      category: "Art Print",
    }),
    art({
      id: "b",
      title: "Bravo",
      price: 10000,
      position: 1,
      popularity: 9,
      category: "Studio Art",
      featured: true,
    }),
    art({ id: "c", title: "Charlie", price: 30000, position: 3, availability: "Reserved" }),
  ];
  const ids = (list: { id: string }[]) => list.map((w) => w.id);

  it("orders by featured, then position, by default", () => {
    expect(ids(filterAndSort(works, NO_FILTERS))).toEqual(["b", "a", "c"]);
  });

  it("sorts by price and popularity", () => {
    expect(ids(filterAndSort(works, { ...NO_FILTERS, sort: "price-low" }))).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(ids(filterAndSort(works, { ...NO_FILTERS, sort: "price-high" }))).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(ids(filterAndSort(works, { ...NO_FILTERS, sort: "popular" }))[0]).toBe("b");
  });

  it("searches title, artist, category and collection case-insensitively", () => {
    expect(ids(filterAndSort(works, { ...NO_FILTERS, search: "  BRAV " }))).toEqual(["b"]);
    expect(ids(filterAndSort(works, { ...NO_FILTERS, search: "studio" }))).toEqual(["b"]);
    expect(filterAndSort(works, { ...NO_FILTERS, search: "found beauty" })).toHaveLength(3);
  });

  it("filters by category, availability and price range", () => {
    expect(ids(filterAndSort(works, { ...NO_FILTERS, category: "Art Print" }))).toEqual(["a", "c"]);
    expect(ids(filterAndSort(works, { ...NO_FILTERS, availability: "Reserved" }))).toEqual(["c"]);
    expect(ids(filterAndSort(works, { ...NO_FILTERS, min: "15000", max: "25000" }))).toEqual(["a"]);
  });

  it("treats a maximum of 0 as a real bound, like the legacy page", () => {
    expect(filterAndSort(works, { ...NO_FILTERS, max: "0" })).toEqual([]);
  });

  it("lists distinct values for the filter dropdowns", () => {
    expect(distinctValues(works, "category")).toEqual(["Art Print", "Studio Art"]);
  });
});
