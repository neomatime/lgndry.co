import Link from "next/link";
import { CartLink } from "@/components/site/cart-link";

/**
 * The slim header on checkout and order confirmation: brand, what this page
 * is, and the cart with one way back. No menu, so a customer mid-purchase
 * isn't tempted away.
 */
export function CommerceHeader({
  title,
  backHref,
  backLabel,
}: {
  title: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <header className="commerce-header">
      <Link href="/">LGNDRY.Co</Link>
      <span>{title}</span>
      <div className="commerce-header__actions">
        <CartLink />
        <Link href={backHref}>{backLabel}</Link>
      </div>
    </header>
  );
}
