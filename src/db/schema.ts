import { pgTable, uuid, text, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  format: text("format").notNull(), // 'stl' | '3mf'
  fileData: text("file_data").notNull(), // base64 payload
  bboxX: real("bbox_x"), // mm
  bboxY: real("bbox_y"), // mm
  bboxZ: real("bbox_z"), // mm
  triangleCount: integer("triangle_count"),
  colorInfo: jsonb("color_info").$type<{
    hasColors?: boolean;
    colorCount?: number;
    colors?: string[];
  }>(),
  isPublic: boolean("is_public").default(true).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type User = typeof users.$inferSelect;
