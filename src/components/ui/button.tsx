import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white border-ink hover:bg-black",
  secondary: "bg-white text-ink border-line-strong hover:bg-surface-soft",
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
