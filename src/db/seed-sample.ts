import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "./index";
import { models, users } from "./schema";
import { ensureAdminUser } from "../lib/auth";
import { eq } from "drizzle-orm";

const SAMPLE_ASCII_STL = `solid calibration_prism
  facet normal 0.0 0.0 -1.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 25.0 20.0 0.0
      vertex 25.0 0.0 0.0
    endloop
  endfacet
  facet normal 0.0 0.0 -1.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 0.0 20.0 0.0
      vertex 25.0 20.0 0.0
    endloop
  endfacet
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 0.0 0.0 15.0
      vertex 25.0 0.0 15.0
      vertex 25.0 20.0 15.0
    endloop
  endfacet
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 0.0 0.0 15.0
      vertex 25.0 20.0 15.0
      vertex 0.0 20.0 15.0
    endloop
  endfacet
  facet normal -1.0 0.0 0.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 0.0 0.0 15.0
      vertex 0.0 20.0 15.0
    endloop
  endfacet
  facet normal -1.0 0.0 0.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 0.0 20.0 15.0
      vertex 0.0 20.0 0.0
    endloop
  endfacet
  facet normal 1.0 0.0 0.0
    outer loop
      vertex 25.0 0.0 0.0
      vertex 25.0 20.0 0.0
      vertex 25.0 20.0 15.0
    endloop
  endfacet
  facet normal 1.0 0.0 0.0
    outer loop
      vertex 25.0 0.0 0.0
      vertex 25.0 20.0 15.0
      vertex 25.0 0.0 15.0
    endloop
  endfacet
  facet normal 0.0 -1.0 0.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 25.0 0.0 0.0
      vertex 25.0 0.0 15.0
    endloop
  endfacet
  facet normal 0.0 -1.0 0.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 25.0 0.0 15.0
      vertex 0.0 0.0 15.0
    endloop
  endfacet
  facet normal 0.0 1.0 0.0
    outer loop
      vertex 0.0 20.0 0.0
      vertex 0.0 20.0 15.0
      vertex 25.0 20.0 15.0
    endloop
  endfacet
  facet normal 0.0 1.0 0.0
    outer loop
      vertex 0.0 20.0 0.0
      vertex 25.0 20.0 15.0
      vertex 25.0 20.0 0.0
    endloop
  endfacet
endsolid calibration_prism`;

async function seed() {
  console.log("Seeding admin user...");
  await ensureAdminUser();

  console.log("Checking sample models...");
  const existing = await db.query.models.findFirst({
    where: eq(models.slug, "sample-cube"),
  });

  if (!existing) {
    const buffer = Buffer.from(SAMPLE_ASCII_STL, "utf-8");
    await db.insert(models).values({
      slug: "sample-cube",
      title: "Calibration Prism (25×20×15mm)",
      description: "Sample CAD calibration prism for verifying 3D WebGL framing and metrology HUD.",
      fileName: "calibration_prism.stl",
      fileSize: buffer.length,
      format: "stl",
      fileData: buffer.toString("base64"),
      bboxX: 25.0,
      bboxY: 20.0,
      bboxZ: 15.0,
      triangleCount: 12,
      colorInfo: { hasColors: false, colors: ["#38bdf8"] },
      isPublic: true,
      viewCount: 1,
    });
    console.log("Created sample model: /share/sample-cube");
  } else {
    console.log("Sample model already exists.");
  }
}

seed()
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
