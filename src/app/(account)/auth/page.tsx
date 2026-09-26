import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPage } from "@/features/customer-account/components/auth-page";

export const metadata: Metadata = {
  title: { absolute: "Customer Account — LGNDRY.Co" },
  description: "Create or access your secure LGNDRY.Co customer account.",
};

export default function CustomerAuthPage() {
  return (
    // The form reads ?mode= and ?next=, which the static page can't know until it is running.
    <Suspense fallback={null}>
      <AuthPage />
    </Suspense>
  );
}
