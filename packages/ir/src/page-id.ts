import type { Page } from "./types.ts";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Stable, URL-safe 11-character alias. Internal IDs and stored references stay unchanged.
 * FNV-1a is used for addressing convenience, never for authentication or secrecy.
 */
export function shortPageId(id: string): string {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(id)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  }
  let encoded = "";
  for (let index = 0; index < 11; index++) {
    encoded = ALPHABET[Number(hash & 63n)] + encoded;
    hash >>= 6n;
  }
  return encoded;
}

export type PageResolution =
  | { readonly ok: true; readonly page: Page }
  | { readonly ok: false; readonly message: string };

/** Full IDs take precedence. Never choose silently between colliding aliases or names. */
export function resolvePageQuery(
  pages: readonly Page[],
  query: string,
): PageResolution {
  const exact = pages.find((page) => page.id === query);
  if (exact) return { ok: true, page: exact };
  const aliases = pages.filter((page) => shortPageId(page.id) === query);
  const named = pages.filter((page) => page.name === query);
  const matches = [
    ...new Map([...aliases, ...named].map((page) => [page.id, page])).values(),
  ];
  if (matches.length === 1) return { ok: true, page: matches[0] as Page };
  if (matches.length > 1)
    return {
      ok: false,
      message: aliases.length
        ? `Page query "${query}" is ambiguous; pass the full page id instead.`
        : `Several pages are named "${query}"; pass the page id instead.`,
    };
  return {
    ok: false,
    message: `No page has the id, short id or name "${query}".`,
  };
}
