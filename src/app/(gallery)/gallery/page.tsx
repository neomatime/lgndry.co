import type { Metadata } from "next";
import Link from "next/link";
import { galleryAccess } from "@/features/gallery/access";
import { GalleryScreen } from "@/features/gallery/components/gallery-screen";

export const metadata: Metadata = {
  title: { absolute: "Gallery — LGNDRY.Co" },
};

function Message({ title, message }: { title: string; message: string }) {
  return (
    <div className="error">
      <h1>{title}</h1>
      <p>{message}</p>
    </div>
  );
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id: rawId } = await searchParams;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const access = id ? await galleryAccess(id) : null;

  return (
    <>
      <header className="gallery-header">
        <Link href="/">LGNDRY.Co</Link>
        <span>Gallery Delivery</span>
      </header>
      <main id="content">
        {!id ? (
          <Message title="Gallery not found" message="This link is missing a gallery reference." />
        ) : access?.state === "ok" ? (
          <GalleryScreen id={id} open={access.gallery} />
        ) : access?.state === "locked" || access?.state === "wrong_password" ? (
          <GalleryScreen id={id} open={null} />
        ) : access?.state === "error" ? (
          <Message
            title="Gallery unavailable"
            message="Something went wrong loading this gallery. Please try again."
          />
        ) : (
          <Message
            title="Gallery unavailable"
            message="This link may have expired or is no longer available."
          />
        )}
      </main>
    </>
  );
}
