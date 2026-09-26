import { createSupabaseAnonClient } from "@/lib/db/anon";

/** A gallery as a visitor may see it: never includes the password. */
export type PublicGallery = {
  id: string;
  title: string | null;
  /** One file address per line. */
  files: string | null;
  /** "YYYY-MM-DD", or null when it never expires. */
  expiry: string | null;
  downloads: string | null;
  status: string;
};

export type GalleryAccess =
  | { state: "ok"; gallery: PublicGallery }
  | { state: "locked" | "wrong_password" | "not_found" | "error" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Asks the database whether this visitor may open the gallery. The password is
 * checked inside the database (gallery_access), and the gallery's contents
 * only come back once it is satisfied.
 */
export async function galleryAccess(id: string, password = ""): Promise<GalleryAccess> {
  if (!UUID.test(id)) return { state: "not_found" };
  try {
    const { data, error } = await createSupabaseAnonClient().rpc("gallery_access", {
      gallery_id: id,
      gallery_password: password,
    });
    if (error) throw error;
    const result = data as { state?: string; gallery?: PublicGallery } | null;
    if (result?.state === "ok" && result.gallery) return { state: "ok", gallery: result.gallery };
    if (
      result?.state === "locked" ||
      result?.state === "wrong_password" ||
      result?.state === "not_found"
    ) {
      return { state: result.state };
    }
    return { state: "error" };
  } catch (error) {
    console.error("gallery: access check failed", error);
    return { state: "error" };
  }
}

/** Moves a gallery's status forward (Viewed, then Downloaded). Failures are ignored: it's only a record. */
export async function markGalleryStatus(
  id: string,
  status: "Viewed" | "Downloaded",
  password = "",
): Promise<void> {
  if (!UUID.test(id)) return;
  try {
    await createSupabaseAnonClient().rpc("gallery_mark", {
      gallery_id: id,
      new_status: status,
      gallery_password: password,
    });
  } catch (error) {
    console.error("gallery: could not record status", error);
  }
}
