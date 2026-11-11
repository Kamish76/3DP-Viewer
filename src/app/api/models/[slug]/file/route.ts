import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const model = await db.query.models.findFirst({
      where: eq(models.slug, slug),
    });

    if (!model) {
      return new NextResponse("Model not found", { status: 404 });
    }

    if (!model.isPublic) {
      const session = await getSession();
      if (!session) {
        return new NextResponse("Private model", { status: 403 });
      }
    }

    const buffer = Buffer.from(model.fileData, "base64");
    const mimeType =
      model.format === "3mf"
        ? "model/3mf"
        : "model/stl";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(model.fileName)}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: unknown) {
    console.error("Stream file error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
