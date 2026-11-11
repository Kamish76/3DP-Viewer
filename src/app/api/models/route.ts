import { NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const list = await db.query.models.findMany({
      orderBy: [desc(models.createdAt)],
      columns: {
        id: true,
        slug: true,
        title: true,
        description: true,
        fileName: true,
        fileSize: true,
        format: true,
        bboxX: true,
        bboxY: true,
        bboxZ: true,
        triangleCount: true,
        colorInfo: true,
        isPublic: true,
        viewCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ models: list });
  } catch (err: unknown) {
    console.error("List models error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
