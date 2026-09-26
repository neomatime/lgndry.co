import type { Metadata } from "next";
import { Suspense } from "react";
import { CommerceHeader } from "@/components/site/commerce-header";
import { OrderConfirmation } from "@/features/shop/components/order-confirmation";

export const metadata: Metadata = {
  title: { absolute: "Order Received — LGNDRY.Co" },
  robots: { index: false, follow: false },
};

export default function OrderConfirmationPage() {
  return (
    <>
      <CommerceHeader title="Collection order" backHref="/collection" backLabel="The collection" />
      <main className="confirmation-page" id="main-content">
        <Suspense fallback={null}>
          <OrderConfirmation />
        </Suspense>
      </main>
    </>
  );
}
