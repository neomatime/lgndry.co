import { describe, expect, it } from "vitest";
import { descriptorForFile, storagePathFor } from "./upload-contract";

const SESSION_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("descriptorForFile", () => {
  it("uses the file name, exact size, and canonical MIME type", () => {
    const file = new File(["abc"], "Brief.PDF", { type: "text/plain" });

    expect(descriptorForFile(file)).toEqual({
      fileName: "Brief.PDF",
      sizeBytes: 3,
      mimeType: "application/pdf",
    });
  });
});

describe("storagePathFor", () => {
  it("creates a safe path below the session prefix", () => {
    expect(storagePathFor(SESSION_ID, 2, "../My Brief!!.pdf")).toBe(
      `${SESSION_ID}/2-..My Brief.pdf`,
    );
  });

  it("keeps duplicate names distinct by index", () => {
    expect(storagePathFor(SESSION_ID, 0, "brief.pdf")).not.toBe(
      storagePathFor(SESSION_ID, 1, "brief.pdf"),
    );
  });

  it("rejects malformed session ids and indexes", () => {
    expect(() => storagePathFor("not-a-uuid", 0, "brief.pdf")).toThrow(/session id/i);
    expect(() => storagePathFor(SESSION_ID, 5, "brief.pdf")).toThrow(/index/i);
  });
});
