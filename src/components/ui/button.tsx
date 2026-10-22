import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white border-ink hover:bg-black hover:shadow-[var(--ops-shadow-raised)]",
  secondary:
    "bg-white text-ink border-line-strong hover:bg-surface-soft hover:shadow-[var(--ops-shadow-resting)]",
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
        "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ops-radius-sm)] border px-4 text-sm font-medium transition-[background-color,border-color,box-shadow,transform] duration-[var(--ops-motion-fast)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
