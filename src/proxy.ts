import { auth } from "@/lib/auth/server";
import { isOwnerEmail } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

// Initialize Neon Auth middleware instance
const authMiddleware = auth.middleware({
  loginUrl: "/login",
});

function decodeJwtPayload(token: string): { user?: { email?: string | null } } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  // 1. Intercept incoming OAuth verifier, exchange cookies, and reject non-owner accounts
  if (request.nextUrl.searchParams.has("neon_auth_session_verifier")) {
    const response = await authMiddleware(request);
    const setCookies = response.headers.getSetCookie();

    const sessionDataCookie = setCookies.find(
      (header) =>
        header.startsWith("__Secure-neon-auth.local.session_data=") ||
        header.startsWith("neon-auth.local.session_data=")
    );

    if (sessionDataCookie) {
      const rawValue = sessionDataCookie.split(";")[0]?.split("=").slice(1).join("=");
      const payload = rawValue ? decodeJwtPayload(decodeURIComponent(rawValue)) : null;

      if (payload?.user && !isOwnerEmail(payload.user.email)) {
        // Best-effort upstream sign-out so the unauthorized session token cannot persist.
        const tokenCookie = setCookies
          .map((h) => h.split(";")[0])
          .find((kv) => kv.includes("neon-auth") && kv.includes("session_token"));
        const baseUrl =
          process.env.NEON_AUTH_BASE_URL ||
          "https://ep-dawn-sun-bdlgjo1g.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth";

        if (tokenCookie) {
          await fetch(`${baseUrl}/sign-out`, {
            method: "POST",
            headers: {
              Cookie: tokenCookie,
              Origin: request.nextUrl.origin,
            },
          }).catch(() => {});
        }

        const deniedUrl = new URL("/login", request.url);
        deniedUrl.searchParams.set("error", "unauthorized_email");
        if (payload.user.email) {
          deniedUrl.searchParams.set("email", payload.user.email);
        }

        const deniedResponse = NextResponse.redirect(deniedUrl);
        for (const cookieName of [
          "__Secure-neon-auth.local.session_data",
          "__Secure-neon-auth.session_token",
          "__Secure-neon-auth.session_challenge",
          "__Secure-neon-auth.session_challange",
          "neon-auth.local.session_data",
          "neon-auth.session_token",
        ]) {
          deniedResponse.cookies.set(cookieName, "", {
            path: "/",
            maxAge: 0,
            httpOnly: true,
            secure: cookieName.startsWith("__Secure-"),
            sameSite: "lax",
          });
        }
        return deniedResponse;
      }
    }

    return response;
  }

  // 2. Allow standard route evaluation so public pages (/share, /embed) remain accessible
  return NextResponse.next();
}

export { proxy as middleware };
export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
