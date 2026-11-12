import { auth } from "@/lib/auth/server";
import { NextResponse, type NextRequest } from "next/server";

// Initialize Neon Auth middleware instance
const authMiddleware = auth.middleware({
  loginUrl: "/login",
});

export async function proxy(request: NextRequest) {
  // 1. Intercept incoming OAuth verifier and perform cookie exchange
  if (request.nextUrl.searchParams.has("neon_auth_session_verifier")) {
    return authMiddleware(request);
  }

  // 2. Allow standard route evaluation so public pages (/share, /embed) remain accessible
  return NextResponse.next();
}

export { proxy as middleware };
export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
