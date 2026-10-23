import type { Metadata } from "next";
import Image from "next/image";
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
    <main className="auth-login-shell grid min-h-svh bg-[#f7f6f2] lg:grid-cols-[minmax(0,3fr)_minmax(30rem,2fr)]">
      <section className="auth-login-visual relative min-h-[16rem] overflow-hidden sm:min-h-[21rem] lg:min-h-svh">
        <Image
          src="/ops-login-landscape.jpg"
          alt="A person seated thoughtfully in a sunlit grassland"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover object-[61%_53%] sm:object-[61%_55%] lg:object-[59%_center]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,17,13,0.24),transparent_35%)]"
          aria-hidden="true"
        />
        <p className="absolute bottom-7 left-7 max-w-52 text-[0.62rem] leading-[1.65] font-medium tracking-[0.22em] text-white uppercase sm:bottom-10 sm:left-10 lg:bottom-16 lg:left-14">
          Extraordinary stories.
          <br />
          Real-world impact.
        </p>
      </section>

      <section className="auth-login-panel relative flex min-h-[calc(100svh-16rem)] flex-col bg-[radial-gradient(circle_at_38%_38%,rgba(255,255,255,0.95),rgba(247,246,242,0.96)_58%,rgba(240,237,231,0.94))] px-6 py-9 sm:min-h-[calc(100svh-21rem)] sm:px-12 sm:py-12 lg:min-h-svh lg:px-14 lg:py-12 xl:px-20 2xl:px-24">
        <div className="mx-auto flex w-full max-w-[28rem] flex-1 items-center py-7 lg:py-12">
          <div className="auth-login-content w-full">
            <Wordmark />

            <div className="mt-12 sm:mt-14">
              <h1 className="text-[1.7rem] leading-tight font-medium tracking-[-0.01em]">
                Sign in to continue
              </h1>
              <p className="text-ink-muted mt-2 max-w-[24rem] text-[0.96rem] leading-6">
                Access your workspace to manage enquiries, projects and client relationships.
              </p>
            </div>

            <div className="mt-9">
              <LoginForm
                next={safeNext}
                initialError={
                  error === "forbidden"
                    ? "That account doesn't have access to the Command Center."
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        <footer className="border-line text-ink-muted mx-auto w-full max-w-[28rem] shrink-0 border-t pt-5 text-center text-xs">
          &copy; {new Date().getFullYear()} LGNDRY.Co. All rights reserved.
        </footer>
      </section>
    </main>
  );
}
