import type { Metadata } from "next";
import { Suspense } from "react";
import { CommerceHeader } from "@/components/site/commerce-header";
import { CheckoutForm } from "@/features/shop/components/checkout-form";

export const metadata: Metadata = {
  title: { absolute: "Checkout — LGNDRY.Co" },
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <>
      <CommerceHeader title="Secure checkout" backHref="/cart" backLabel="Return to cart" />
      <main className="checkout-page" id="main-content">
        <header className="commerce-page__head">
          <span>Collection acquisition</span>
          <h1>Complete your order.</h1>
          <p>
            Complete your details and choose EFT or payment in person. Availability and final
            delivery are confirmed before fulfilment.
          </p>
        </header>
        <div data-checkout="">
          {/* The form reads ?type=request, which the static page can't know until it is running. */}
          <Suspense fallback={null}>
            <CheckoutForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
