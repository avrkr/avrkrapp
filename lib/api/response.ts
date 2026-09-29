import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(
  message: string,
  code: string,
  status = 400,
  details?: unknown,
) {
  const body: Record<string, unknown> = { success: false, message, code };
  if (details !== undefined && process.env.APP_ENV !== "production") {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}
