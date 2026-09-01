import { NextResponse } from "next/server";

/**
 * Short, memorable entry point for players — "nothingsus.app/play". A
 * `?code=` is carried through so QR codes and printed cards can deep-link
 * straight to a filled-in login.
 */
export function GET(request: Request) {
  const src = new URL(request.url);
  const dest = new URL("/participant", src);
  const code = src.searchParams.get("code");
  if (code) dest.searchParams.set("code", code);
  return NextResponse.redirect(dest);
}
