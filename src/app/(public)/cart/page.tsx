import type { Metadata } from "next";
import { CartFooter } from "@/components/site/shop-footer";
import { CartView } from "@/features/shop/components/cart-view";

export const metadata: Metadata = {
  title: { absolute: "Your Cart — LGNDRY.Co" },
  description: "Review your selected LGNDRY.Co artworks.",
  alternates: { canonical: "/cart" },
};

export default function CartPage() {
  return (
    <>
      <main className="commerce-page" id="main-content" data-cart-page="">
        <CartView />
      </main>
      <CartFooter />
    </>
  );
}
