import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Password login is disabled. Only the site owner Google account is permitted.",
    },
    { status: 403 }
  );
}
