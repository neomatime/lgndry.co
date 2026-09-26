import { NavPanel } from "@/components/site/nav-panel";
import { SiteHeader } from "@/components/site/site-header";

/** The storefront's chrome: the full header with its menu, and the menu panel. */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <NavPanel />
      {children}
    </>
  );
}
