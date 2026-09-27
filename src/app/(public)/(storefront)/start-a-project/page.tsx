import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/site-footer";
import { StartAProjectForm } from "@/features/start-a-project/components/start-a-project-form";

export const metadata: Metadata = {
  title: { absolute: "Start a Project — LGNDRY.Co" },
  description: "Tell us about your project and we'll be in touch within 24 hours.",
  alternates: { canonical: "/start-a-project" },
};

export default function StartAProjectPage() {
  return (
    <>
      <main className="start-a-project-page" id="main-content">
        <header className="commerce-page__head">
          <span>Start a project</span>
          <h1>Tell us about your project.</h1>
          <p>Share a few details and any reference files — we&apos;ll follow up within 24 hours.</p>
        </header>
        <StartAProjectForm />
      </main>
      <SiteFooter />
    </>
  );
}
