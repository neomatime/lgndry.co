"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/site/forms/select";
import { Reveal } from "@/components/site/reveal";
import { addToCart, itemFromProduct } from "@/features/shop/cart/cart-storage";
import {
  editionLabel,
  imageSrc,
  isAvailable,
  sizeOptions,
  type Artwork,
} from "@/features/shop/catalogue/artwork";
import {
  NO_FILTERS,
  distinctValues,
  filterAndSort,
  type CatalogueFilters,
  type SortKey,
} from "@/features/shop/catalogue/filter";
import { formatMoney } from "@/features/shop/money";
import { cn } from "@/lib/utils/cn";

const SORT_LABELS: Record<SortKey, string> = {
  featured: "Featured",
  newest: "Newest",
  "price-low": "Price: low to high",
  "price-high": "Price: high to low",
  popular: "Popularity",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  Available: "Available",
  Reserved: "Reserved",
  "Sold Out": "Sold out",
};

/** How long the "Added" confirmation stays on a card's button. */
const ADDED_MS = 1200;

/** Length of the curtain that covers the page as the showroom opens. */
const CURTAIN_MS = 90;

function Arrow() {
  return (
    <svg width="40" height="8" viewBox="0 0 40 8" fill="none" aria-hidden="true">
      <path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** A labelled dropdown whose entries are given as { value, label } pairs. */
function LabelledSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  // Select works in plain strings; map the display labels back to values.
  const byLabel = new Map(options.map((option) => [option.label, option.value]));
  const byValue = new Map(options.map((option) => [option.value, option.label]));
  return (
    <label>
      <span>{label}</span>
      <Select
        placeholder={placeholder}
        options={options.map((option) => option.label)}
        value={value === "" && placeholder !== undefined ? "" : (byValue.get(value) ?? "")}
        onChange={(picked) => onChange(picked === "" ? "" : (byLabel.get(picked) ?? ""))}
      />
    </label>
  );
}

function ProductCard({
  product,
  added,
  onAdd,
  onOpen,
}: {
  product: Artwork;
  added: boolean;
  onAdd: (product: Artwork, size: string) => void;
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const sizes = sizeOptions(product);
  const [size, setSize] = useState(sizes[0] ?? "");
  const href = `/showroom/${encodeURIComponent(product.id)}`;
  const canAddDirectly = isAvailable(product) && !product.requiresConfirmation;

  return (
    <article className="work commerce-work" data-product-id={product.id}>
      <Link
        className="work__media"
        href={href}
        aria-label={`View ${product.title}`}
        onClick={(event) => onOpen(event, href)}
      >
        {/* Artwork images come from the database at runtime, in unknown sizes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc(product.image)}
          loading="lazy"
          decoding="async"
          alt={`${product.title} by ${product.artist}`}
        />
      </Link>
      <div className="work__body">
        <div className="commerce-work__heading">
          <div>
            <Link href={href} className="commerce-work__title" onClick={(e) => onOpen(e, href)}>
              <h3 className="work__title">{product.title}</h3>
            </Link>
            <p className="work__year">
              {product.artist} · {product.year ?? ""}
            </p>
          </div>
          <p className="commerce-work__availability">{product.availability || "Available"}</p>
        </div>
        <div className="work__row">
          <div className="work__meta">
            <p>{product.collectionName}</p>
            <p>{product.medium}</p>
            <p>{editionLabel(product)}</p>
            <label className="work__size">
              Size:
              <Select
                options={sizes}
                value={size}
                label={`Print size for ${product.title}`}
                onChange={setSize}
              />
            </label>
          </div>
          <p className="work__price">{formatMoney(product.price)}</p>
        </div>
        {canAddDirectly ? (
          <button
            className="work__acquire"
            type="button"
            aria-label={added ? `${product.title} added to cart` : undefined}
            onClick={() => onAdd(product, size)}
          >
            <span>{added ? "Added" : "Add to selection"}</span>
            <Arrow />
          </button>
        ) : (
          <Link className="work__acquire" href={href} onClick={(e) => onOpen(e, href)}>
            <span>View availability</span>
            <Arrow />
          </Link>
        )}
      </div>
    </article>
  );
}

/**
 * The searchable, filterable grid of works. Filtering happens in the browser
 * over the works the server already sent, as the legacy page did.
 */
export function CatalogueBrowser({
  products,
  unavailable = false,
}: {
  products: Artwork[];
  /** True when the collection couldn't be loaded at all. */
  unavailable?: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<CatalogueFilters>(NO_FILTERS);
  const [refineOpen, setRefineOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Arriving back here (from the showroom) lifts the curtain that covered the
  // page on the way out.
  useEffect(() => {
    document.documentElement.classList.remove("showroom-leaving");
    const added = addedTimer;
    const opening = openTimer;
    return () => {
      clearTimeout(added.current);
      clearTimeout(opening.current);
    };
  }, []);

  const update = (patch: Partial<CatalogueFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const visible = filterAndSort(products, filters);

  const add = (product: Artwork, size: string) => {
    addToCart(itemFromProduct(product, { size }));
    setAddedId(product.id);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedId(null), ADDED_MS);
  };

  const openShowroom = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Let "open in new tab" and friends behave normally.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    document.documentElement.classList.add("showroom-leaving");
    openTimer.current = setTimeout(() => router.push(href), CURTAIN_MS);
  };

  const categories = distinctValues(products, "category").map((v) => ({ value: v, label: v }));
  const collections = distinctValues(products, "collectionName").map((v) => ({
    value: v,
    label: v,
  }));
  const artists = distinctValues(products, "artist").map((v) => ({ value: v, label: v }));
  const availabilities = Object.entries(AVAILABILITY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const sorts = Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <>
      <Reveal
        as="section"
        className="catalogue-controls"
        data-commerce-filters=""
        aria-label="Filter and sort the collection"
      >
        <div className="catalogue-controls__primary">
          <label className="catalogue-search">
            <span>Search the collection</span>
            <input
              type="search"
              placeholder="Artwork or artist"
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
            />
          </label>
          <LabelledSelect
            label="Sort by"
            value={filters.sort}
            options={sorts}
            onChange={(value) => update({ sort: (value || "featured") as SortKey })}
          />
          <button
            className="catalogue-filter-toggle"
            type="button"
            aria-expanded={refineOpen}
            onClick={() => setRefineOpen((open) => !open)}
          >
            Refine
          </button>
        </div>
        <div className={cn("catalogue-controls__refine", refineOpen && "is-open")}>
          <LabelledSelect
            label="Category"
            value={filters.category}
            placeholder="All categories"
            options={categories}
            onChange={(category) => update({ category })}
          />
          <LabelledSelect
            label="Collection"
            value={filters.collection}
            placeholder="All collections"
            options={collections}
            onChange={(collection) => update({ collection })}
          />
          <LabelledSelect
            label="Artist"
            value={filters.artist}
            placeholder="All artists"
            options={artists}
            onChange={(artist) => update({ artist })}
          />
          <LabelledSelect
            label="Availability"
            value={filters.availability}
            placeholder="All availability"
            options={availabilities}
            onChange={(availability) => update({ availability })}
          />
          <label>
            <span>Minimum price</span>
            <input
              type="number"
              min="0"
              step="500"
              placeholder="R 0"
              value={filters.min}
              onChange={(event) => update({ min: event.target.value })}
            />
          </label>
          <label>
            <span>Maximum price</span>
            <input
              type="number"
              min="0"
              step="500"
              placeholder="Any"
              value={filters.max}
              onChange={(event) => update({ max: event.target.value })}
            />
          </label>
          <button type="button" className="catalogue-clear" onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        </div>
        <p className="catalogue-results" role="status" aria-live="polite">
          {unavailable ? "" : `${visible.length} ${visible.length === 1 ? "work" : "works"}`}
        </p>
      </Reveal>

      <Reveal as="section" className="collection-grid" data-commerce-catalog="" aria-busy="false">
        {unavailable ? (
          <div className="catalogue-empty">
            <h2>The collection is temporarily unavailable.</h2>
            <p>Please refresh or contact the studio.</p>
          </div>
        ) : visible.length ? (
          visible.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              added={addedId === product.id}
              onAdd={add}
              onOpen={openShowroom}
            />
          ))
        ) : (
          <div className="catalogue-empty">
            <h2>No works found.</h2>
            <p>Adjust the filters to continue exploring the collection.</p>
            <button type="button" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          </div>
        )}
      </Reveal>
    </>
  );
}
