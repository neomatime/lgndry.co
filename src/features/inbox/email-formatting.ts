type SignatureDetails = {
  name: string;
  companyName?: string;
  phone?: string;
  website?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function inlineFormatting(value: string) {
  return escapeHtml(value)
    .replace(
      /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/g,
      '<a href="$2" rel="noreferrer">$1</a>',
    )
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[u\]([^\n]+)\[\/u\]/g, "<u>$1</u>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");
}

/** Converts the composer's small formatting vocabulary into safe email HTML. */
export function emailMarkupToHtml(value: string) {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;

  const closeList = () => {
    if (!list) return;
    output.push(`</${list}>`);
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*-\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    const nextList = bullet ? "ul" : numbered ? "ol" : null;

    if (nextList) {
      if (list !== nextList) {
        closeList();
        list = nextList;
        output.push(`<${list}>`);
      }
      output.push(`<li>${inlineFormatting((bullet ?? numbered)?.[1] ?? "")}</li>`);
      continue;
    }

    closeList();
    if (!line.trim()) {
      output.push("<br>");
      continue;
    }
    output.push(`<div>${inlineFormatting(line)}</div>`);
  }

  closeList();
  return output.join("");
}

export function emailMarkupToPlainText(value: string) {
  return value
    .replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\[u\]([^\n]+)\[\/u\]/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1");
}

function decodeEmailEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Restores drafts created by this composer to their editable formatting vocabulary. */
export function emailHtmlToMarkup(value: string) {
  const inline = (html: string) =>
    decodeEmailEntities(
      html
        .replace(/<a\s+href="((?:https?:\/\/|mailto:)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
        .replace(/<(?:strong|b)>/gi, "**")
        .replace(/<\/(?:strong|b)>/gi, "**")
        .replace(/<(?:em|i)>/gi, "_")
        .replace(/<\/(?:em|i)>/gi, "_")
        .replace(/<u>/gi, "[u]")
        .replace(/<\/u>/gi, "[/u]")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    );

  return value
    .replace(
      /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
      (_match, items: string) =>
        `${Array.from(items.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
          .map((item) => `- ${inline(item[1] ?? "")}`)
          .join("\n")}\n`,
    )
    .replace(
      /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
      (_match, items: string) =>
        `${Array.from(items.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
          .map((item, index) => `${index + 1}. ${inline(item[1] ?? "")}`)
          .join("\n")}\n`,
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p)>/gi, "\n")
    .replace(/<(?:div|p)[^>]*>/gi, "")
    .split("\n")
    .map((line) => inline(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function buildEmailSignature({
  name,
  companyName = "LGNDRY.Co",
  phone,
  website,
}: SignatureDetails) {
  return ["Kind regards,", name.trim(), companyName.trim(), phone?.trim(), website?.trim()]
    .filter(Boolean)
    .join("\n");
}

export function appendSignature(body: string, signature: string) {
  const cleanSignature = signature.trim();
  if (!cleanSignature || body.includes(cleanSignature)) return body;
  return `${body.trimEnd()}${body.trim() ? "\n\n" : ""}--\n${cleanSignature}`;
}
