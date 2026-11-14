import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth/server";

const COOKIE_NAME = "admin_session";

export const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.ALLOWED_GOOGLE_EMAILS?.split(",")[0] ||
  "jabezrafael1@gmail.com"
)
  .trim()
  .toLowerCase();

/** Strictly restricts owner privileges to the configured sole owner email. */
export function isOwnerEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === OWNER_EMAIL);
}

export async function ensureAdminUser(): Promise<void> {
  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, OWNER_EMAIL),
    });

    if (!existing) {
      await db
        .insert(users)
        .values({
          username: OWNER_EMAIL,
          email: OWNER_EMAIL,
          passwordHash: null,
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error("[auth] Failed to ensure owner user:", err);
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<{
  userId: string;
  username: string;
  role: string;
  email: string;
  avatarUrl?: string;
  picture?: string;
} | null> {
  try {
    const neonSession = await auth.getSession();
    const user = neonSession?.data?.user;
    if (!user?.email || !isOwnerEmail(user.email)) {
      return null;
    }

    return {
      userId: user.id,
      username: user.name || user.email,
      role: "admin",
      email: user.email,
      avatarUrl: user.image || undefined,
      picture: user.image || undefined,
    };
  } catch {
    return null;
  }
}
