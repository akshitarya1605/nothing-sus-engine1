import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { handleRoute } from "@/lib/api/respond";

export async function POST() {
  return handleRoute(async () => {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  });
}
