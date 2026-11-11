import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const model = await db.query.models.findFirst({
      where: eq(models.slug, slug),
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

    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    if (!model.isPublic) {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Increment view count asynchronously
    await db
      .update(models)
      .set({ viewCount: sql`${models.viewCount} + 1` })
      .where(eq(models.slug, slug));

    return NextResponse.json({ model });
  } catch (err: unknown) {
    console.error("Get model error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    await db.delete(models).where(eq(models.slug, slug));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Delete model error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const body = await req.json();
    const { title, description, isPublic } = body;

    const updates: Partial<{
      title: string;
      description: string | null;
      isPublic: boolean;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim() || null;
    if (isPublic !== undefined) updates.isPublic = !!isPublic;

    await db.update(models).set(updates).where(eq(models.slug, slug));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Update model error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
