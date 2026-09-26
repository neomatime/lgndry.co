"use client";

import { useEffect, useRef, useState } from "react";
import { recordGalleryActivity, unlockGallery } from "@/features/gallery/actions";
import type { PublicGallery } from "@/features/gallery/access";
import { imageSrc, lines } from "@/features/shop/catalogue/artwork";

function GalleryContent({ gallery, password }: { gallery: PublicGallery; password: string }) {
  const files = lines(gallery.files);
  const downloadsEnabled = gallery.downloads !== "Disabled";
  const recorded = useRef(false);

  // Opening a gallery the studio has sent marks it as viewed (once).
  useEffect(() => {
    if (recorded.current || gallery.status !== "Sent" || !files.length) return;
    recorded.current = true;
    void recordGalleryActivity(gallery.id, "Viewed", password);
  }, [gallery.id, gallery.status, password, files.length]);

  if (!files.length) {
    return (
      <div className="empty">
        <h1>{gallery.title || "Gallery"}</h1>
        <p>This gallery has no images uploaded yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="gallery-title">{gallery.title || "Your Gallery"}</h1>
      <p className="gallery-meta">
        {files.length} image{files.length === 1 ? "" : "s"}
        {gallery.expiry ? ` · Available until ${gallery.expiry}` : ""}
      </p>
      <div className="gallery-grid">
        {files.map((url) => (
          <figure className="gallery-item" key={url}>
            {/* Client photographs, in whatever size they were delivered. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(url)} alt={gallery.title || ""} loading="lazy" />
            {downloadsEnabled ? (
              <a
                className="download"
                href={imageSrc(url)}
                download
                onClick={() => void recordGalleryActivity(gallery.id, "Downloaded", password)}
              >
                Download
              </a>
            ) : null}
          </figure>
        ))}
      </div>
    </>
  );
}

function Gate({
  id,
  onUnlock,
}: {
  id: string;
  onUnlock: (gallery: PublicGallery, password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true);
    setError("");
    try {
      const result = await unlockGallery(id, password);
      if (result.ok) onUnlock(result.gallery, password);
      else setError(result.error);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setChecking(false);
  };

  return (
    <div className="gate">
      <h1>Password Protected</h1>
      <p>This gallery is protected. Enter the password shared with you to view it.</p>
      <input
        type="password"
        placeholder="Password"
        aria-label="Gallery password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !checking) void submit();
        }}
      />
      <button type="button" disabled={checking} onClick={() => void submit()}>
        View Gallery
      </button>
      <p className="gate-error" role="status" aria-live="polite">
        {error}
      </p>
    </div>
  );
}

/**
 * A client's gallery. Either open straight away, or behind a password gate
 * whose answer is checked on the server, so the files only reach the browser
 * once it is right.
 */
export function GalleryScreen({
  id,
  open,
}: {
  id: string;
  /** The gallery, when it needs no password; null when the gate must be shown. */
  open: PublicGallery | null;
}) {
  const [unlocked, setUnlocked] = useState<{ gallery: PublicGallery; password: string } | null>(
    open ? { gallery: open, password: "" } : null,
  );
  if (unlocked) return <GalleryContent gallery={unlocked.gallery} password={unlocked.password} />;
  return <Gate id={id} onUnlock={(gallery, password) => setUnlocked({ gallery, password })} />;
}
