import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_KEY, readCart } from "@/features/shop/cart/cart-storage";
import { artworkFromRow, type Artwork } from "@/features/shop/catalogue/artwork";
import { CartView } from "@/features/shop/components/cart-view";
import { CatalogueBrowser } from "@/features/shop/components/catalogue-browser";
import { CHECKOUT_TYPE_KEY, ShowroomView } from "@/features/shop/components/showroom-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const work = (over: Record<string, unknown> = {}): Artwork =>
  artworkFromRow({
    id: "a",
    title: "Alpha",
    price: 20000,
    category: "Art Print",
    collectionName: "Found Beauty",
    availability: "Available",
    remaining: 3,
    editionSize: 15,
    image: "assests/images/a.jpg",
    sizes: "50 × 70 cm\n60 × 90 cm",
    framingOptions: "Unframed\nMounted",
    position: 1,
    year: 2025,
    ...over,
  });

const ALPHA = work();
const BRAVO = work({ id: "b", title: "Bravo", price: 10000, category: "Studio Art", position: 2 });
const CHARLIE = work({
  id: "c",
  title: "Charlie",
  price: 30000,
  availability: "Reserved",
  position: 3,
});
const WORKS = [ALPHA, BRAVO, CHARLIE];

/** Opens a themed dropdown and picks an option by its label, as a visitor would. */
function pick(dropdown: Element | null, label: string) {
  const scope = within(dropdown as HTMLElement);
  fireEvent.click(scope.getByRole("button", { expanded: false }));
  fireEvent.click(scope.getByRole("option", { name: label }));
}

const type = (box: HTMLElement, value: string) => fireEvent.change(box, { target: { value } });

beforeEach(() => {
  push.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("CatalogueBrowser", () => {
  it("lists every work with a count", () => {
    render(<CatalogueBrowser products={WORKS} />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("3 works");
  });

  it("narrows by search and offers a way back from an empty result", () => {
    render(<CatalogueBrowser products={WORKS} />);
    type(screen.getByRole("searchbox"), "brav");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("1 work");

    type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByRole("heading", { name: "No works found." })).toBeInTheDocument();

    const empty = document.querySelector<HTMLElement>(".catalogue-empty")!;
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("sorts by price", () => {
    const { container } = render(<CatalogueBrowser products={WORKS} />);
    pick(
      container.querySelector(".catalogue-controls__primary .lgndry-select"),
      "Price: low to high",
    );
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Bravo", "Alpha", "Charlie"]);
  });

  it("filters by availability using the labels shown to visitors", () => {
    const { container } = render(<CatalogueBrowser products={WORKS} />);
    fireEvent.click(screen.getByRole("button", { name: "Refine" }));
    const dropdowns = container.querySelectorAll(".catalogue-controls__refine .lgndry-select");
    pick(dropdowns[3] ?? null, "Reserved");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3, name: "Charlie" })).toBeInTheDocument();
  });

  it("adds the chosen size to the cart and confirms briefly", () => {
    vi.useFakeTimers();
    render(<CatalogueBrowser products={[ALPHA]} />);
    const card = screen.getByRole("article");
    pick(card.querySelector(".work__size .lgndry-select"), "60 × 90 cm");
    fireEvent.click(within(card).getByRole("button", { name: "Add to selection" }));

    expect(readCart()).toMatchObject([{ artworkId: "a", size: "60 × 90 cm", quantity: 1 }]);
    expect(within(card).getByRole("button", { name: "Alpha added to cart" })).toHaveTextContent(
      "Added",
    );

    act(() => vi.advanceTimersByTime(1300));
    expect(within(card).getByRole("button", { name: "Add to selection" })).toBeInTheDocument();
  });

  it("links works that can't be added straight away to their showroom page", () => {
    render(<CatalogueBrowser products={[CHARLIE]} />);
    expect(screen.getByRole("link", { name: /View availability/ })).toHaveAttribute(
      "href",
      "/showroom/c",
    );
    expect(screen.queryByRole("button", { name: /Add to selection/ })).toBeNull();
  });

  it("says so when the collection could not be loaded", () => {
    render(<CatalogueBrowser products={[]} unavailable />);
    expect(screen.getByText("The collection is temporarily unavailable.")).toBeInTheDocument();
  });

  it("opens the showroom after a short curtain, but leaves modified clicks alone", () => {
    vi.useFakeTimers();
    render(<CatalogueBrowser products={[ALPHA]} />);
    const link = screen.getByRole("link", { name: "View Alpha" });

    fireEvent.click(link, { ctrlKey: true });
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(document.documentElement).toHaveClass("showroom-leaving");
    expect(push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(push).toHaveBeenCalledWith("/showroom/a");
    document.documentElement.classList.remove("showroom-leaving");
  });
});

describe("ShowroomView", () => {
  it("adds the chosen size, frame, presentation and quantity to the cart", () => {
    const { container } = render(<ShowroomView product={ALPHA} related={[]} />);
    const dropdowns = container.querySelectorAll(".showroom-field .lgndry-select");
    pick(dropdowns[0] ?? null, "60 × 90 cm");
    fireEvent.click(screen.getByRole("button", { name: "Oak Frame" }));
    pick(dropdowns[1] ?? null, "Mounted");
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(readCart()).toMatchObject([
      { artworkId: "a", size: "60 × 90 cm", framing: "Oak Frame / Mounted", quantity: 2 },
    ]);
    expect(screen.getByText("Added to your cart.")).toBeInTheDocument();
  });

  it("never lets the quantity buttons pass the edition or go below one", () => {
    render(<ShowroomView product={work({ remaining: 2 })} related={[]} />);
    const quantity = screen.getByRole("spinbutton", { name: "Quantity" });
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(quantity).toHaveValue(2);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(quantity).toHaveValue(1);
  });

  it("sends an order request through checkout, flagged for confirmation", () => {
    render(<ShowroomView product={ALPHA} related={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Send Order Request" }));

    expect(readCart()).toMatchObject([{ artworkId: "a", requiresConfirmation: true }]);
    expect(window.sessionStorage.getItem(CHECKOUT_TYPE_KEY)).toBe("Order Request");
    expect(push).toHaveBeenCalledWith("/checkout?type=request");
  });

  it("offers only an order request for a work that can't be bought outright", () => {
    render(<ShowroomView product={CHARLIE} related={[]} />);
    expect(screen.queryByRole("button", { name: "Add to Cart" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send Order Request" })).toBeInTheDocument();
  });

  it("previews the work in a room and returns to the photograph", () => {
    const { container } = render(<ShowroomView product={ALPHA} related={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Bedroom/ }));
    expect(container.querySelector(".showroom-room-preview")).not.toHaveAttribute("hidden");
    expect(container.querySelector(".curated-card.is-active")).toHaveAttribute(
      "data-space",
      "bedroom",
    );

    fireEvent.click(screen.getByRole("button", { name: "Next view" }));
    expect(container.querySelector(".showroom-room-preview")).toHaveAttribute("hidden");
  });

  it("describes the edition and lists related works", () => {
    render(<ShowroomView product={ALPHA} related={[BRAVO]} />);
    expect(screen.getByText("Edition of 15 - 3 available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bravo/ })).toHaveAttribute("href", "/showroom/b");
  });
});

describe("CartView", () => {
  const stored = [
    {
      artworkId: "a",
      title: "Alpha",
      size: "50 × 70 cm",
      framing: "Unframed",
      quantity: 2,
      price: 20000,
      maxQuantity: 3,
      image: "x.jpg",
    },
    {
      artworkId: "b",
      title: "Bravo",
      size: "60 × 90 cm",
      framing: "Oak Frame",
      quantity: 1,
      price: 10000,
      maxQuantity: 1,
      image: "y.jpg",
    },
  ];

  it("invites a visitor with an empty cart to the collection", () => {
    render(<CartView />);
    expect(screen.getByRole("heading", { name: "Your cart is empty." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the collection" })).toHaveAttribute(
      "href",
      "/collection",
    );
  });

  it("lists the lines with subtotal, delivery and total", () => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(stored));
    render(<CartView />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText(`R 50 000`, { selector: "dd" })).toBeInTheDocument(); // subtotal
    expect(screen.getByText("R 250")).toBeInTheDocument(); // delivery
    expect(screen.getByText(`R 50 250`)).toBeInTheDocument(); // total
    expect(screen.getByRole("link", { name: "Proceed to Checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });

  it("removes a line", () => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(stored));
    render(<CartView />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha from cart" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(readCart()).toHaveLength(1);
  });

  it("changes a quantity when the box is left, capped at the edition, and not while typing", () => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(stored));
    render(<CartView />);
    const box = screen.getByRole("spinbutton", { name: "Quantity for Alpha" });

    // Typing: a real keystroke reports an inputType; the spinner arrows don't.
    fireEvent.input(box, { target: { value: "" }, inputType: "deleteContentBackward" });
    expect(readCart()).toHaveLength(2); // still there: nothing committed yet
    fireEvent.input(box, { target: { value: "9" }, inputType: "insertText" });
    expect(readCart()[0]?.quantity).toBe(2);

    fireEvent.blur(box);
    expect(readCart()[0]?.quantity).toBe(3);
    expect(screen.getByRole("spinbutton", { name: "Quantity for Alpha" })).toHaveValue(3);
  });

  it("changes a quantity at once when the spinner arrows are used", () => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(stored));
    render(<CartView />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity for Alpha" }), {
      target: { value: "1" },
    });
    expect(readCart()[0]?.quantity).toBe(1);
  });
});
