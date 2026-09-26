import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallback } from "@/features/customer-account/components/auth-callback";

export const metadata: Metadata = {
  title: { absolute: "Verify Your Account — LGNDRY.Co" },
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallback />
    </Suspense>
  );
}
