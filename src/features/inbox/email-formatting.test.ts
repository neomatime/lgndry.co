import { describe, expect, it } from "vitest";
import {
  appendSignature,
  buildEmailSignature,
  emailHtmlToMarkup,
  emailMarkupToHtml,
  emailMarkupToPlainText,
} from "@/features/inbox/email-formatting";

describe("Inbox email formatting", () => {
  it("renders the supported formatting vocabulary as safe HTML", () => {
    const html = emailMarkupToHtml(
      "**Hello** _there_ [u]today[/u]\n- First item\n- Second item\n[Open](https://example.com)",
    );
    expect(html).toContain("<strong>Hello</strong>");
    expect(html).toContain("<em>there</em>");
    expect(html).toContain("<u>today</u>");
    expect(html).toContain("<ul><li>First item</li><li>Second item</li></ul>");
    expect(html).toContain('<a href="https://example.com"');
  });

  it("escapes arbitrary HTML and rejects unsafe links", () => {
    const html = emailMarkupToHtml("<img src=x onerror=alert(1)> [Bad](javascript:alert(1))");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
  });

  it("creates readable plain text and a non-duplicating signature", () => {
    expect(emailMarkupToPlainText("**Hello** [site](https://example.com)")).toBe(
      "Hello site (https://example.com)",
    );
    const signature = buildEmailSignature({
      name: "Neo Matime",
      phone: "+27 10 555 0187",
      website: "https://www.lgndry-co.co.za",
    });
    expect(appendSignature("Hello", signature)).toContain("--\nKind regards,\nNeo Matime");
    expect(
      appendSignature(appendSignature("Hello", signature), signature).match(/Kind regards/g),
    ).toHaveLength(1);
  });

  it("restores a formatted draft without leaking HTML into the editor", () => {
    const source = "**Hello** _there_\n- First item\n- Second item\n[Open](https://example.com)";
    expect(emailHtmlToMarkup(emailMarkupToHtml(source))).toBe(source);
  });
});
