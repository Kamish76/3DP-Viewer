import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAppOrigin,
  getGoogleOAuthUrl,
  isGoogleOAuthConfigured,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    if (!isGoogleOAuthConfigured()) {
      return NextResponse.redirect(
        new URL("/login?error=not_configured", req.url)
      );
    }

    const origin = getAppOrigin(req);
    const state = crypto.randomUUID();

    const cookieStore = await cookies();
    cookieStore.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    const authUrl = getGoogleOAuthUrl(origin, state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[auth/google] Initialization error:", err);
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", req.url)
    );
  }
}
