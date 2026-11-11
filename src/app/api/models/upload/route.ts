import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { models } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
