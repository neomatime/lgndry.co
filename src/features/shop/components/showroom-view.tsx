"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/site/forms/select";
import { addToCart, itemFromProduct } from "@/features/shop/cart/cart-storage";
import {
  editionLabel,
  imageSrc,
  isAvailable,
  lines,
  sizeOptions,
  type Artwork,
} from "@/features/shop/catalogue/artwork";
import { formatMoney } from "@/features/shop/money";
import {
  FRAMES,
  SPACES,
  frameKey,
  placement,
  type NaturalSize,
  type Space,
} from "@/features/shop/showroom/room-math";
import { cn } from "@/lib/utils/cn";

const DEFAULT_STORY =
  "An original work from the LGNDRY.Co collection, created through an attentive study of people, place, and presence.";

/** How long the "Added to Cart" confirmation stays on the button. */
const ADDED_MS = 1400;

/** Session key the checkout page reads to know it was opened for an order request. */
export const CHECKOUT_TYPE_KEY = "lgndry_checkout_type";

const TRUST_ICONS = {
  quality: (
    <>
      <rect x="5" y="3" width="14" height="18" />
      <rect x="8" y="6" width="8" height="12" />
    </>
  ),
  auth: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m8 14-1 7 5-3 5 3-1-7" />
    </>
  ),
  edition: <path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" />,
  delivery: (
    <>
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  returns: <path d="M4 8V3m0 0h5M4 3l4 4a7 7 0 1 1-1 10" />,
};

const TRUST: { icon: keyof typeof TRUST_ICONS; title: string; note: string }[] = [
  { icon: "quality", title: "Museum Quality", note: "Archival materials" },
  { icon: "auth", title: "Certificate of Authenticity", note: "Included with every work" },
  { icon: "edition", title: "Signed & Numbered", note: "Limited edition" },
  { icon: "delivery", title: "Secure Delivery", note: "Carefully packaged" },
  { icon: "returns", title: "Considered Returns", note: "Personal assistance" },
];

/** The artwork drawn onto a room photograph, sized for the chosen print. */
function CuratedArt({
  src,
  room,
  hero = false,
  size,
  frame,
  natural,
}: {
  src: string;
  room: Space;
  hero?: boolean;
  size: string;
  frame: string;
  natural: NaturalSize | null;
}) {
  const { scale, ratio } = placement(room, hero ? 1.5 : 4 / 3, size, natural);
  return (
    <span
      className={cn("curated-art", hero && "curated-art--hero")}
      data-curated-art=""
      data-frame={frameKey(frame)}
      data-selected-size={size}
      title={`${size} shown against an approximately ${room.wallWidth} cm wall`}
      style={
        {
          left: "53%",
          top: `${room.y}%`,
          "--art-scale": scale,
          "--art-ratio": ratio,
        } as React.CSSProperties
      }
    >
      <span
        style={{ position: "relative", display: "block", overflow: "hidden", aspectRatio: ratio }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
          }}
        />
      </span>
    </span>
  );
}

/**
 * One artwork's page: gallery, "in context" room previews, and the choices
 * (size, frame, presentation, quantity) that end in the cart or an order request.
 */
export function ShowroomView({ product, related }: { product: Artwork; related: Artwork[] }) {
  const router = useRouter();
  const gallery = (() => {
    const images = product.imageList.filter(Boolean);
    return images.includes(product.image) ? images : [product.image, ...images];
  })().map(imageSrc);
  const sizes = sizeOptions(product);
  const presentations = lines(product.framingOptions);
  if (!presentations.length) presentations.push("Unframed");
  const available = isAvailable(product);
  const maxQuantity = Math.max(1, product.remaining || 1);

  const [index, setIndex] = useState(0);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [size, setSize] = useState(sizes[0] ?? "");
  const [frame, setFrame] = useState<string>(FRAMES[0]);
  const [presentation, setPresentation] = useState(presentations[0] ?? "");
  const [quantity, setQuantity] = useState("1");
  const [zoomed, setZoomed] = useState(false);
  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const [feedback, setFeedback] = useState("");
  const [added, setAdded] = useState(false);

  const stageRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLImageElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const activeSpace = SPACES.find((space) => space.id === spaceId) ?? null;
  const firstImage = gallery[0] ?? "";

  useEffect(() => {
    // Arriving from the collection: lift the curtain it dropped on the way out.
    document.documentElement.classList.remove("showroom-leaving");
    const timer = addedTimer;
    return () => clearTimeout(timer.current);
  }, []);

  // The original file's pixel size is read from the first image, once it is
  // loaded (it may already be by the time this runs).
  useEffect(() => {
    const image = mainRef.current;
    if (!image?.complete || !image.naturalWidth) return;
    // Deferred so the state update isn't made synchronously inside the effect.
    queueMicrotask(() => setNatural({ width: image.naturalWidth, height: image.naturalHeight }));
  }, []);

  const showImage = (next: number) => {
    setIndex((next + gallery.length) % gallery.length);
    setSpaceId(null);
  };

  const showSpace = (id: string) => {
    setSpaceId(id);
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const cartItem = (overrides: { requiresConfirmation?: boolean } = {}) => ({
    ...itemFromProduct(product, {
      size,
      framing: `${frame} / ${presentation}`,
      quantity: Number(quantity || 1),
    }),
    ...overrides,
  });

  const add = () => {
    addToCart(cartItem());
    setFeedback("Added to your cart.");
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), ADDED_MS);
  };

  const requestOrder = () => {
    addToCart(cartItem({ requiresConfirmation: true }));
    try {
      window.sessionStorage.setItem(CHECKOUT_TYPE_KEY, "Order Request");
    } catch {
      // Storage blocked: the checkout page also reads ?type=request.
    }
    router.push("/checkout?type=request");
  };

  const setStageZoomPoint = (event: React.PointerEvent<HTMLElement>) => {
    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    stage.style.setProperty("--zx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    stage.style.setProperty("--zy", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  };

  const spaceForMount = activeSpace ?? SPACES[0]!;

  return (
    <>
      <Link className="showroom-back" href="/collection">
        &larr; Return to the collection
      </Link>
      <section className="showroom-hero">
        <div className="showroom-experience">
          <div className="showroom-gallery">
            <figure
              ref={stageRef}
              className={cn("showroom-gallery__main", zoomed && "is-zoomed")}
              onPointerMove={setStageZoomPoint}
            >
              {/* Artwork images come from the database at runtime, in unknown sizes. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={mainRef}
                src={gallery[index]}
                hidden={activeSpace !== null}
                alt={`${product.title} by ${product.artist}`}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                data-showroom-main=""
                onLoad={(event) => {
                  if (index !== 0) return;
                  const image = event.currentTarget;
                  setNatural({ width: image.naturalWidth, height: image.naturalHeight });
                }}
              />
              <div
                className="showroom-room-preview"
                hidden={activeSpace === null}
                data-space={activeSpace?.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeSpace?.image}
                  alt="Curated interior"
                  loading="lazy"
                  decoding="async"
                />
                <CuratedArt
                  hero
                  src={firstImage}
                  room={spaceForMount}
                  size={size}
                  frame={frame}
                  natural={natural}
                />
              </div>
              <button
                className="showroom-zoom"
                type="button"
                aria-label="Zoom artwork"
                onClick={() => setZoomed((on) => !on)}
              >
                +
              </button>
            </figure>
            <div className="showroom-gallery__rail">
              <button
                className="gallery-arrow"
                type="button"
                aria-label="Previous view"
                onClick={() => showImage(index - 1)}
              >
                &larr;
              </button>
              <div className="showroom-gallery__thumbs">
                {gallery.map((image, i) => (
                  <button
                    key={`${image}-${i}`}
                    type="button"
                    className={cn(i === index && activeSpace === null && "is-active")}
                    onClick={() => showImage(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt={`Artwork view ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
              <button
                className="gallery-arrow"
                type="button"
                aria-label="Next view"
                onClick={() => showImage(index + 1)}
              >
                &rarr;
              </button>
            </div>
          </div>

          <section className="curated-spaces">
            <div className="curated-spaces__head">
              <div>
                <span className="showroom-eyebrow">In context</span>
                <h2>Curated Spaces</h2>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => trackRef.current?.scrollBy({ left: -360, behavior: "smooth" })}
                >
                  &larr;
                </button>
                <button
                  type="button"
                  onClick={() => trackRef.current?.scrollBy({ left: 360, behavior: "smooth" })}
                >
                  &rarr;
                </button>
              </div>
            </div>
            <div ref={trackRef} className="curated-spaces__track">
              {SPACES.map((space) => (
                <button
                  key={space.id}
                  className={cn("curated-card", space.id === spaceId && "is-active")}
                  type="button"
                  data-space={space.id}
                  onClick={() => showSpace(space.id)}
                >
                  <span className="curated-card__scene">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={space.image}
                      alt={`${space.style} ${space.name}`}
                      loading="lazy"
                      decoding="async"
                    />
                    <CuratedArt
                      src={firstImage}
                      room={space}
                      size={size}
                      frame={frame}
                      natural={natural}
                    />
                    <span className="curated-card__overlay">Preview Space</span>
                  </span>
                  <strong>{space.name}</strong>
                  <small>{space.style}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="showroom-trust">
            {TRUST.map((item) => (
              <div key={item.title}>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  {TRUST_ICONS[item.icon]}
                </svg>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.note}</small>
                </span>
              </div>
            ))}
          </section>
        </div>

        <article className="showroom-details">
          <span className="showroom-eyebrow">{product.collectionName}</span>
          <h1>{product.title}</h1>
          <p className="showroom-artist">{product.artist}</p>
          <p className="showroom-story">{product.description || DEFAULT_STORY}</p>
          <dl className="showroom-specs">
            <div>
              <dt>Medium</dt>
              <dd>{product.medium}</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{product.dimensions || sizes.join(", ")}</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>{product.year ?? "-"}</dd>
            </div>
            <div>
              <dt>Original file</dt>
              <dd>
                {natural
                  ? `${natural.width.toLocaleString()} x ${natural.height.toLocaleString()} px`
                  : "Reading image..."}
              </dd>
            </div>
            <div>
              <dt>Edition</dt>
              <dd>{editionLabel(product, " - ")}</dd>
            </div>
          </dl>
          <div className="showroom-purchase">
            <div className="showroom-price">
              <strong>{formatMoney(product.price)}</strong>
              <span>{product.availability || "Available"}</span>
            </div>
            <div className="showroom-options">
              <label className="showroom-field">
                <span>Size</span>
                <Select options={sizes} value={size} label="Size" onChange={setSize} />
              </label>
              <fieldset className="showroom-frames">
                <legend>Frame</legend>
                <div>
                  {FRAMES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={cn(option === frame && "is-active")}
                      onClick={() => setFrame(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="showroom-field">
                <span>Presentation</span>
                <Select
                  options={presentations}
                  value={presentation}
                  label="Presentation"
                  onChange={setPresentation}
                />
              </label>
              <div className="showroom-quantity">
                <span>Quantity</span>
                <div>
                  <button
                    type="button"
                    onClick={() => setQuantity(String(Math.max(1, Number(quantity) - 1)))}
                  >
                    &minus;
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity}
                    aria-label="Quantity"
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(String(Math.min(maxQuantity, Number(quantity) + 1)))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <p className="showroom-delivery">
              Estimated delivery: {product.deliveryEstimate}. Delivery fees are calculated at
              checkout.
            </p>
            <div className="showroom-actions">
              {available && !product.requiresConfirmation ? (
                <button type="button" className="showroom-primary" onClick={add}>
                  {added ? "Added to Cart" : "Add to Cart"}
                </button>
              ) : null}
              <button type="button" className="showroom-secondary" onClick={requestOrder}>
                Send Order Request
              </button>
            </div>
            <p className="showroom-feedback" role="status" aria-live="polite">
              {feedback}
            </p>
          </div>
        </article>
      </section>

      {related.length ? (
        <section className="showroom-related">
          <div className="showroom-related__head">
            <span className="showroom-eyebrow">Continue exploring</span>
            <h2>Related works</h2>
          </div>
          <div className="showroom-related__grid">
            {related.map((work) => (
              <Link
                key={work.id}
                className="showroom-related__item"
                href={`/showroom/${encodeURIComponent(work.id)}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc(work.image)} alt={work.title} loading="lazy" decoding="async" />
                <span>{work.title}</span>
                <small>
                  {work.artist} &middot; {formatMoney(work.price)}
                </small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
