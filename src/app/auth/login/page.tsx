import type { Metadata } from "next";
import { Wordmark } from "@/components/branding/wordmark";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNextPath } from "@/features/auth/schemas/sign-in";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  const safeNext = next ? safeNextPath(next) : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="border-line w-full max-w-sm border bg-white p-8">
        <Wordmark />
        <h1 className="mt-8 text-lg font-medium">Sign in to continue</h1>
        {error === "forbidden" ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            That account doesn&apos;t have access to the Command Center.
          </p>
        ) : null}
        <div className="mt-6">
          <LoginForm next={safeNext} />
        </div>
      </div>
    </main>
  );
}
