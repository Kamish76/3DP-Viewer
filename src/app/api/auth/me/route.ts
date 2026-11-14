import { NextResponse } from "next/server";
import { clearSession, isOwnerEmail } from "@/lib/auth";
import { auth } from "@/lib/auth/server";

export async function POST() {
  await auth.signOut().catch(() => {});
  await clearSession();
  return NextResponse.json({ success: true });
}

export async function GET() {
  const neonSession = await auth.getSession().catch(() => null);
  const user = neonSession?.data?.user;

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (!isOwnerEmail(user.email)) {
    await auth.signOut().catch(() => {});
    await clearSession();
    return NextResponse.json(
      {
        authenticated: false,
        error: "unauthorized_email",
        email: user.email || undefined,
      },
      { status: 403 }
    );
  }

  const sessionUser = {
    username: user.name || user.email,
    email: user.email,
    avatarUrl: user.image || undefined,
    picture: user.image || undefined,
    role: "admin",
  };

  return NextResponse.json({
    authenticated: true,
    user: sessionUser,
    ...sessionUser,
  });
}
