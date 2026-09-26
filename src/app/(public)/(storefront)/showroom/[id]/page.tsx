import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowroomFooter } from "@/components/site/shop-footer";
import { fetchCollection } from "@/features/shop/catalogue/data";
import { ShowroomView } from "@/features/shop/components/showroom-view";

// Prices, stock and new works are edited in the admin, so pages are rebuilt
// from the database at most once a minute. Works added later get their page
// on first visit.
export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const products = await fetchCollection();
  return (products ?? []).map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = (await fetchCollection())?.find((p) => p.id === id);
  if (!product) return { title: { absolute: "Showroom — LGNDRY.Co" } };
  return {
    title: { absolute: `${product.title} - LGNDRY.Co Showroom` },
    description: "Experience and acquire an artwork from the LGNDRY.Co collection.",
    alternates: { canonical: `/showroom/${product.id}` },
  };
}

export default async function ShowroomPage({ params }: Props) {
  const { id } = await params;
  const products = await fetchCollection();
  const product = products?.find((p) => p.id === id);
  if (!product) notFound();

  const related = (products ?? [])
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.artist === product.artist || p.collectionName === product.collectionName),
    )
    .slice(0, 3);

  return (
    <>
      <main className="showroom-page is-ready" id="main-content" data-showroom="">
        <ShowroomView product={product} related={related} />
      </main>
      <ShowroomFooter />
    </>
  );
}
