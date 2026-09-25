// Phase 3 replaces this with the migrated public website. Until then the live
// site is still the static HTML on `main`; this branch only builds the app.
export default function PublicHomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 text-center">
      <p className="font-serif text-3xl">LGNDRY.Co</p>
    </main>
  );
}
