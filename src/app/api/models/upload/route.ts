import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { models } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const maxDuration = 60;

interface ChunkInitPayload {
  phase: "init";
  fileName?: string;
  fileSize?: number;
  title?: string;
  description?: string;
  bboxX?: number | null;
  bboxY?: number | null;
  bboxZ?: number | null;
  triangleCount?: number | null;
  colorInfo?: {
    hasColors?: boolean;
    colorCount?: number;
    colors?: string[];
  };
  chunkBase64?: string;
  isLastChunk?: boolean;
}

interface ChunkAppendPayload {
  phase: "append";
  slug?: string;
  chunkBase64?: string;
  isLastChunk?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as ChunkInitPayload | ChunkAppendPayload;

      if (body.phase === "init") {
        const fileName = typeof body.fileName === "string" ? body.fileName : "";
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        if (ext !== "stl" && ext !== "3mf") {
          return NextResponse.json(
            { error: "Invalid format. Only .stl and .3mf files are supported." },
            { status: 400 }
          );
        }
        if (typeof body.chunkBase64 !== "string" || body.chunkBase64.length === 0) {
          return NextResponse.json({ error: "Missing initial file chunk" }, { status: 400 });
        }

        const slug = `m_${crypto.randomBytes(6).toString("hex")}`;
        const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
        const rawDesc = typeof body.description === "string" ? body.description.trim() : "";
        const fileSize =
          typeof body.fileSize === "number" && Number.isFinite(body.fileSize) && body.fileSize >= 0
            ? Math.round(body.fileSize)
            : Buffer.from(body.chunkBase64, "base64").length;

        const [inserted] = await db
          .insert(models)
          .values({
            slug,
            title: rawTitle || fileName.replace(/\.[^/.]+$/, ""),
            description: rawDesc || null,
            fileName,
            fileSize,
            format: ext,
            fileData: body.chunkBase64,
            bboxX: typeof body.bboxX === "number" && Number.isFinite(body.bboxX) ? body.bboxX : null,
            bboxY: typeof body.bboxY === "number" && Number.isFinite(body.bboxY) ? body.bboxY : null,
            bboxZ: typeof body.bboxZ === "number" && Number.isFinite(body.bboxZ) ? body.bboxZ : null,
            triangleCount:
              typeof body.triangleCount === "number" && Number.isFinite(body.triangleCount)
                ? Math.round(body.triangleCount)
                : null,
            colorInfo: body.colorInfo && typeof body.colorInfo === "object" ? body.colorInfo : {},
            isPublic: Boolean(body.isLastChunk),
          })
          .returning();

        return NextResponse.json({
          success: true,
          slug: inserted.slug,
          model: {
            id: inserted.id,
            slug: inserted.slug,
            title: inserted.title,
            format: inserted.format,
            fileSize: inserted.fileSize,
          },
        });
      }

      if (body.phase === "append") {
        if (typeof body.slug !== "string" || !body.slug) {
          return NextResponse.json({ error: "Missing model slug" }, { status: 400 });
        }
        if (typeof body.chunkBase64 !== "string") {
          return NextResponse.json({ error: "Missing chunk payload" }, { status: 400 });
        }

        const [updated] = await db
          .update(models)
          .set({
            fileData: sql`${models.fileData} || ${body.chunkBase64}`,
            updatedAt: new Date(),
            ...(body.isLastChunk ? { isPublic: true } : {}),
          })
          .where(eq(models.slug, body.slug))
          .returning({ slug: models.slug });

        if (!updated) {
          return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          slug: updated.slug,
        });
      }

      return NextResponse.json({ error: "Invalid upload phase" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";
    const bboxX = parseFloat((formData.get("bboxX") as string) || "0");
    const bboxY = parseFloat((formData.get("bboxY") as string) || "0");
    const bboxZ = parseFloat((formData.get("bboxZ") as string) || "0");
    const triangleCount = parseInt((formData.get("triangleCount") as string) || "0", 10);
    const colorsJson = (formData.get("colorInfo") as string) || "{}";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext !== "stl" && ext !== "3mf") {
      return NextResponse.json(
        { error: "Invalid format. Only .stl and .3mf files are supported." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    const slug = `m_${crypto.randomBytes(6).toString("hex")}`;

    let parsedColors: { hasColors?: boolean; colors?: string[] } = {};
    try {
      parsedColors = JSON.parse(colorsJson);
    } catch {
      parsedColors = {};
    }

    const [inserted] = await db
      .insert(models)
      .values({
        slug,
        title: title.trim() || file.name.replace(/\.[^/.]+$/, ""),
        description: description.trim() || null,
        fileName: file.name,
        fileSize: file.size,
        format: ext,
        fileData: base64Data,
        bboxX: isNaN(bboxX) ? null : bboxX,
        bboxY: isNaN(bboxY) ? null : bboxY,
        bboxZ: isNaN(bboxZ) ? null : bboxZ,
        triangleCount: isNaN(triangleCount) ? null : triangleCount,
        colorInfo: parsedColors,
        isPublic: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      slug: inserted.slug,
      model: {
        id: inserted.id,
        slug: inserted.slug,
        title: inserted.title,
        format: inserted.format,
        fileSize: inserted.fileSize,
      },
    });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
