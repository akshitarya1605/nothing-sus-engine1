import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { GameEngineError, HTTP_STATUS_BY_CODE } from "../game/errors";

/** Every route handler's body is wrapped in this — one place maps a
 * GameEngineError to the right HTTP status, and any unexpected error
 * still returns a generic 500 instead of leaking a stack trace. */
export async function handleRoute(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GameEngineError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: HTTP_STATUS_BY_CODE[err.code] },
      );
    }
    console.error("[api] unhandled error", err);
    return NextResponse.json({ error: "INTERNAL", message: "Unexpected error" }, { status: 500 });
  }
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new GameEngineError("VALIDATION", "Request body must be valid JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new GameEngineError("VALIDATION", result.error.issues.map((i) => i.message).join("; "));
  }
  return result.data;
}
