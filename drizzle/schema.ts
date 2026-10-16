import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Track page visits */
export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: varchar("path", { length: 256 }).notNull().default("/"),
  referrer: text("referrer"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Track API endpoint usage */
export const apiRequests = pgTable("api_requests", {
  id: serial("id").primaryKey(),
  endpoint: varchar("endpoint", { length: 128 }).notNull(),
  targetUrl: text("targetUrl"),
  status: integer("status").notNull().default(200),
  durationMs: integer("durationMs"),
  filesCount: integer("filesCount"),
  totalBytes: integer("totalBytes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PageView = typeof pageViews.$inferSelect;
export type ApiRequest = typeof apiRequests.$inferSelect;
