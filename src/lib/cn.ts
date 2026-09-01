/** Tiny classname joiner — truthy strings only, no dedupe. Enough for our
 * components; we don't have conflicting-utility merge needs. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
