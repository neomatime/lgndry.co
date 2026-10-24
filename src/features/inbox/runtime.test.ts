import { describe, expect, it } from "vitest";
import {
  inboxSyncErrorMessage,
  readEdgeFunctionError,
  resolveInboxAssetOrigin,
} from "@/features/inbox/runtime";

describe("Inbox runtime helpers", () => {
  it("uses the current Command Center origin for public email assets", () => {
    expect(
      resolveInboxAssetOrigin(
        new Headers({
          "x-forwarded-host": "ops.lgndry-co.co.za",
          "x-forwarded-proto": "https",
        }),
        {},
        "https://www.lgndry-co.co.za",
      ),
    ).toBe("https://ops.lgndry-co.co.za");
  });

  it("falls back to the deployment URL when request headers are unavailable", () => {
    expect(
      resolveInboxAssetOrigin(
        new Headers(),
        { VERCEL_PROJECT_PRODUCTION_URL: "lgndrycp-site.vercel.app" },
        "https://www.lgndry-co.co.za",
      ),
    ).toBe("https://lgndrycp-site.vercel.app");
  });

  it("rejects malformed forwarded hosts", () => {
    expect(
      resolveInboxAssetOrigin(
        new Headers({ "x-forwarded-host": "attacker.example/path" }),
        {},
        "https://www.lgndry-co.co.za/work",
      ),
    ).toBe("https://www.lgndry-co.co.za");
  });

  it("reads the structured body from a Supabase function HTTP error", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify({ error: "AUTHENTICATIONFAILED AuthenticationError" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    };

    const detail = await readEdgeFunctionError(null, error);
    expect(detail).toBe("AUTHENTICATIONFAILED AuthenticationError");
    expect(inboxSyncErrorMessage(detail)).toContain("Enable third-party email access");
  });

  it("keeps an ordinary function failure generic", async () => {
    const detail = await readEdgeFunctionError(null, { message: "Internal server error" });
    expect(inboxSyncErrorMessage(detail)).toBe("The mailbox could not be synchronized just now.");
  });
});
