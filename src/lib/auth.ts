import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "stl-viewer-fallback-session-secret-key-min-32-chars-long"
);
const COOKIE_NAME = "admin_session";
export const OAUTH_STATE_COOKIE = "oauth_state";

export interface GoogleUser {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  picture?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function ensureAdminUser(): Promise<void> {
  try {
    const defaultUsername = process.env.ADMIN_USERNAME || "admin";
    const defaultPassword = process.env.ADMIN_PASSWORD || "changeme123";

    const existing = await db.query.users.findFirst({
      where: eq(users.username, defaultUsername),
    });

    if (!existing) {
      const passwordHash = await hashPassword(defaultPassword);
      await db.insert(users).values({
        username: defaultUsername,
        passwordHash,
      });
      console.log(`[auth] Default admin user '${defaultUsername}' seeded successfully.`);
    }
  } catch (err) {
    console.error("[auth] Failed to ensure admin user:", err);
  }
}

export async function createSession(
  username: string,
  extra?: { email?: string; avatarUrl?: string }
): Promise<string> {
  const token = await new SignJWT({
    username,
    role: "admin",
    email: extra?.email,
    avatarUrl: extra?.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return token;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<{
  username: string;
  role: string;
  email?: string;
  avatarUrl?: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      username: payload.username as string,
      role: payload.role as string,
      email: payload.email as string | undefined,
      avatarUrl: payload.avatarUrl as string | undefined,
    };
  } catch {
    return null;
  }
}

export function getAppOrigin(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleOAuthUrl(origin: string, state: string): string {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: `${origin}/api/auth/google/callback`,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    access_type: "offline",
    response_type: "code",
    prompt: "select_account",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ].join(" "),
    state,
  };
  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

export async function exchangeGoogleCode(code: string, origin: string): Promise<GoogleUser> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${errText}`);
  }

  const tokens = await tokenRes.json();

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Failed to fetch Google user profile");
  }

  return (await userRes.json()) as GoogleUser;
}

export function isEmailAllowed(email: string): boolean {
  const allowed = process.env.ALLOWED_GOOGLE_EMAILS;
  if (!allowed || !allowed.trim()) {
    // If not set, allow authenticated Google user in dev
    return true;
  }
  const list = allowed.split(",").map((e) => e.trim().toLowerCase());
  return list.includes(email.trim().toLowerCase());
}

export async function upsertGoogleUser(googleUser: GoogleUser): Promise<void> {
  try {
    const normalizedEmail = googleUser.email.toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existing) {
      await db
        .update(users)
        .set({
          avatarUrl: googleUser.picture || existing.avatarUrl,
        })
        .where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({
        username: normalizedEmail,
        email: normalizedEmail,
        avatarUrl: googleUser.picture,
      });
    }
  } catch (err) {
    console.error("[auth] Failed to upsert Google user:", err);
  }
}
