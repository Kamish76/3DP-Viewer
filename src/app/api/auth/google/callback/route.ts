import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAppOrigin,
  exchangeGoogleCode,
  isEmailAllowed,
  upsertGoogleUser,
  createSession,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req);
  const searchParams = req.nextUrl.searchParams;

  const googleError = searchParams.get("error");
  if (googleError) {
    console.warn("[auth/google/callback] Google returned error:", googleError);
    return NextResponse.redirect(new URL("/login?error=cancelled", origin));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!state || !savedState || state !== savedState) {
    console.error("[auth/google/callback] CSRF state mismatch:", { state, savedState });
    return NextResponse.redirect(new URL("/login?error=invalid_state", origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  try {
    const googleUser = await exchangeGoogleCode(code, origin);

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/login?error=missing_email", origin));
    }

    if (!isEmailAllowed(googleUser.email)) {
      console.warn(`[auth/google/callback] Unauthorized email attempt: ${googleUser.email}`);
      const encodedEmail = encodeURIComponent(googleUser.email);
      return NextResponse.redirect(
        new URL(`/login?error=unauthorized_email&email=${encodedEmail}`, origin)
      );
    }

    await upsertGoogleUser(googleUser);

    await createSession(googleUser.email, {
      email: googleUser.email,
      avatarUrl: googleUser.picture,
    });

    return NextResponse.redirect(new URL("/admin", origin));
  } catch (err) {
    console.error("[auth/google/callback] Exchange error:", err);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }
}
