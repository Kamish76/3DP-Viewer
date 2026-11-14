import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);

    const [meta] = await db
      .select({
        id: models.id,
        slug: models.slug,
        fileName: models.fileName,
        fileSize: models.fileSize,
        format: models.format,
        isPublic: models.isPublic,
        base64Length: sql<number>`length(${models.fileData})::int`,
      })
      .from(models)
      .where(eq(models.slug, slug))
      .limit(1);

    if (!meta) {
      return new NextResponse("Model not found", { status: 404 });
    }

    if (!meta.isPublic) {
      const session = await getSession();
      if (!session) {
        return new NextResponse("Private model", { status: 403 });
      }
    }

    const cacheControl = meta.isPublic
      ? "public, max-age=31536000, immutable"
      : "private, no-store";

    if (url.searchParams.get("meta") === "1") {
      return NextResponse.json(
        {
          fileSize: meta.fileSize,
          base64Length: Number(meta.base64Length),
          format: meta.format,
          fileName: meta.fileName,
        },
        { headers: { "Cache-Control": cacheControl } }
      );
    }

    if (url.searchParams.has("offset") && url.searchParams.has("length")) {
      const offset = Number.parseInt(url.searchParams.get("offset") || "", 10);
      const length = Number.parseInt(url.searchParams.get("length") || "", 10);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(length) ||
        length <= 0 ||
        length > 4 * 1024 * 1024
      ) {
        return new NextResponse("Invalid chunk range", { status: 400 });
      }

      const [row] = await db
        .select({
          chunk: sql<string>`substr(${models.fileData}, ${sql.raw(String(offset + 1))}, ${sql.raw(String(length))})`,
        })
        .from(models)
        .where(eq(models.slug, slug))
        .limit(1);

      const chunkBuffer = Buffer.from(row?.chunk || "", "base64");
      return new NextResponse(chunkBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": chunkBuffer.length.toString(),
          "Cache-Control": cacheControl,
        },
      });
    }

    const [row] = await db
      .select({ fileData: models.fileData })
      .from(models)
      .where(eq(models.slug, slug))
      .limit(1);

    const buffer = Buffer.from(row?.fileData || "", "base64");
    const mimeType = meta.format === "3mf" ? "model/3mf" : "model/stl";
    const streamChunk = 65536;
    const stream = new ReadableStream({
      start(controller) {
        for (let pos = 0; pos < buffer.length; pos += streamChunk) {
          controller.enqueue(buffer.subarray(pos, Math.min(pos + streamChunk, buffer.length)));
        }
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(meta.fileName)}"`,
        "Cache-Control": cacheControl,
      },
    });
  } catch (err: unknown) {
    console.error("Stream file error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
