"use server";

import { galleryAccess, markGalleryStatus, type PublicGallery } from "@/features/gallery/access";

export type UnlockResult = { ok: true; gallery: PublicGallery } | { ok: false; error: string };

/** Checks a gallery password on the server; the gallery only comes back if it is right. */
export async function unlockGallery(id: string, password: string): Promise<UnlockResult> {
  const access = await galleryAccess(String(id), String(password));
  if (access.state === "ok") return { ok: true, gallery: access.gallery };
  if (access.state === "error") {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (access.state === "not_found") {
    return { ok: false, error: "This gallery is no longer available." };
  }
  return { ok: false, error: "Incorrect password." };
}

/** Records that the client opened or downloaded the gallery. */
export async function recordGalleryActivity(
  id: string,
  status: "Viewed" | "Downloaded",
  password: string,
): Promise<void> {
  if (status !== "Viewed" && status !== "Downloaded") return;
  await markGalleryStatus(String(id), status, String(password ?? ""));
}
