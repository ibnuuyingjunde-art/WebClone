-- Add page_views and api_requests tracking tables
CREATE TABLE IF NOT EXISTS "page_views" (
  "id" serial PRIMARY KEY,
  "path" varchar(256) NOT NULL DEFAULT '/',
  "referrer" text,
  "userAgent" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_requests" (
  "id" serial PRIMARY KEY,
  "endpoint" varchar(128) NOT NULL,
  "targetUrl" text,
  "status" integer NOT NULL DEFAULT 200,
  "durationMs" integer,
  "filesCount" integer,
  "totalBytes" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
