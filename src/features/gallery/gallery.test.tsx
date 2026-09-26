import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { galleryAccess, markGalleryStatus } from "@/features/gallery/access";
import { GalleryScreen } from "@/features/gallery/components/gallery-screen";

const rpc = vi.fn();
vi.mock("@/lib/db/anon", () => ({ createSupabaseAnonClient: () => ({ rpc }) }));

const ID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const gallery = (over: Record<string, unknown> = {}) => ({
  id: ID,
  title: "Wedding",
  files: "assests/a.jpg\nhttps://host/b.jpg\n",
  expiry: "2026-12-31",
  downloads: "Enabled",
  status: "Sent",
  ...over,
});

beforeEach(() => {
  rpc.mockReset();
});

describe("galleryAccess", () => {
  it("returns the gallery when the database says ok", async () => {
    rpc.mockResolvedValue({ data: { state: "ok", gallery: gallery() }, error: null });
    expect(await galleryAccess(ID)).toEqual({ state: "ok", gallery: gallery() });
    expect(rpc).toHaveBeenCalledWith("gallery_access", { gallery_id: ID, gallery_password: "" });
  });

  it("passes the states through", async () => {
    for (const state of ["locked", "wrong_password", "not_found"] as const) {
      rpc.mockResolvedValue({ data: { state }, error: null });
      expect(await galleryAccess(ID, "pw")).toEqual({ state });
    }
  });

  it("treats anything that isn't a gallery id as not found, without asking the database", async () => {
    expect(await galleryAccess("nope")).toEqual({ state: "not_found" });
    expect(await galleryAccess("1 or 1=1")).toEqual({ state: "not_found" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a database failure as an error rather than throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await galleryAccess(ID)).toEqual({ state: "error" });
    rpc.mockResolvedValue({ data: { state: "surprise" }, error: null });
    expect(await galleryAccess(ID)).toEqual({ state: "error" });
  });
});

describe("markGalleryStatus", () => {
  it("records the status with the password", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await markGalleryStatus(ID, "Downloaded", "pw");
    expect(rpc).toHaveBeenCalledWith("gallery_mark", {
      gallery_id: ID,
      new_status: "Downloaded",
      gallery_password: "pw",
    });
  });

  it("does nothing for a bad id and never throws", async () => {
    await markGalleryStatus("nope", "Viewed");
    expect(rpc).not.toHaveBeenCalled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockImplementation(() => Promise.reject(new Error("offline")));
    await expect(markGalleryStatus(ID, "Viewed")).resolves.toBeUndefined();
  });
});

describe("gallery server actions", () => {
  it("unlocks with the right password and refuses the wrong one", async () => {
    const { unlockGallery } = await import("@/features/gallery/actions");
    rpc.mockResolvedValue({ data: { state: "ok", gallery: gallery() }, error: null });
    expect(await unlockGallery(ID, "right")).toEqual({ ok: true, gallery: gallery() });

    rpc.mockResolvedValue({ data: { state: "wrong_password" }, error: null });
    expect(await unlockGallery(ID, "wrong")).toEqual({ ok: false, error: "Incorrect password." });

    rpc.mockResolvedValue({ data: { state: "not_found" }, error: null });
    expect(await unlockGallery(ID, "x")).toMatchObject({ ok: false });
  });

  it("ignores an activity status it doesn't know", async () => {
    const { recordGalleryActivity } = await import("@/features/gallery/actions");
    await recordGalleryActivity(ID, "Draft" as "Viewed", "");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("GalleryScreen", () => {
  it("shows an open gallery with its count, expiry and downloads, and marks it viewed once", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    render(<GalleryScreen id={ID} open={gallery()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Wedding" })).toBeInTheDocument();
    expect(screen.getByText("2 images · Available until 2026-12-31")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(2);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", "/assests/a.jpg");
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        "gallery_mark",
        expect.objectContaining({ new_status: "Viewed" }),
      ),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("records a download when a client downloads a file", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    render(<GalleryScreen id={ID} open={gallery({ status: "Viewed" })} />);
    fireEvent.click(screen.getAllByRole("link", { name: "Download" })[0]!);
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        "gallery_mark",
        expect.objectContaining({ new_status: "Downloaded" }),
      ),
    );
  });

  it("offers no downloads when they are switched off", () => {
    render(<GalleryScreen id={ID} open={gallery({ downloads: "Disabled", status: "Viewed" })} />);
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it("says when a gallery has no images yet, and singular for one image", () => {
    const { unmount } = render(<GalleryScreen id={ID} open={gallery({ files: "" })} />);
    expect(screen.getByText(/no images uploaded yet/)).toBeInTheDocument();
    unmount();
    render(
      <GalleryScreen id={ID} open={gallery({ files: "a.jpg", expiry: null, status: "Viewed" })} />,
    );
    expect(screen.getByText("1 image")).toBeInTheDocument();
  });

  it("keeps the files back until the right password is given", async () => {
    rpc.mockResolvedValueOnce({ data: { state: "wrong_password" }, error: null });
    render(<GalleryScreen id={ID} open={null} />);
    expect(screen.getByRole("heading", { name: "Password Protected" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();

    fireEvent.change(screen.getByLabelText("Gallery password"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "View Gallery" }));
    expect(await screen.findByText("Incorrect password.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();

    rpc.mockResolvedValue({
      data: { state: "ok", gallery: gallery({ status: "Viewed" }) },
      error: null,
    });
    fireEvent.change(screen.getByLabelText("Gallery password"), { target: { value: "right" } });
    fireEvent.keyDown(screen.getByLabelText("Gallery password"), { key: "Enter" });
    expect(await screen.findByRole("heading", { level: 1, name: "Wedding" })).toBeInTheDocument();
    expect(rpc).toHaveBeenLastCalledWith("gallery_access", {
      gallery_id: ID,
      gallery_password: "right",
    });
  });
});
