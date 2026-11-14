import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { isOwnerEmail } from "@/lib/auth";

const handler = auth.handler();

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { path: segments = [] } = await context.params;
  const path = segments.join("/");

  const response = await handler.GET(request, context);

  if (path === "get-session") {
    const data = (await response
      .clone()
      .json()
      .catch(() => null)) as { user?: { email?: string | null } } | null;

    if (data?.user && !isOwnerEmail(data.user.email)) {
      await auth.signOut().catch(() => {});
      return NextResponse.json(null, { status: 403 });
    }
  }

  return response;
}

export async function POST(request: Request, context: RouteContext) {
  const { path: segments = [] } = await context.params;
  const path = segments.join("/");

  if (
    path.startsWith("sign-up") ||
    path.startsWith("sign-in/email") ||
    path.startsWith("sign-in/magic-link") ||
    path.startsWith("sign-in/anonymous")
  ) {
    return NextResponse.json(
      {
        error:
          "Sign-up and password login are disabled. Only the site owner Google account is permitted.",
      },
      { status: 403 }
    );
  }

  return handler.POST(request, context);
}

export const { PUT, DELETE, PATCH } = handler;
