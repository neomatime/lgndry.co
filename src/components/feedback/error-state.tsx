import { Button } from "@/components/ui/button";

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="border-line border px-6 py-14 text-center">
      <p className="font-medium">Something went wrong loading this page.</p>
      <p className="text-ink-muted mt-2 text-sm">
        Try again. If it keeps happening, tell us what you were doing.
      </p>
      <Button variant="secondary" className="mt-5" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
