import "server-only";
import { NextResponse } from "next/server";

function getAllowedOrigins(request: Request) {
  const origins = new Set<string>();
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // ignore invalid APP_URL
    }
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http");
    origins.add(`${proto}://${host}`);
  }

  return origins;
}

function extractRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function requireSameOrigin(request: Request): NextResponse | null {
  const requestOrigin = extractRequestOrigin(request);
  if (!requestOrigin) {
    return NextResponse.json({ error: "Missing origin." }, { status: 403 });
  }

  const allowedOrigins = getAllowedOrigins(request);
  if (!allowedOrigins.has(requestOrigin)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  return null;
}
