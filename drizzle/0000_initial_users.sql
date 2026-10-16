DO $$ BEGIN
  CREATE TYPE "role" AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "openId" varchar(64) NOT NULL,
  "name" text,
  "email" varchar(320),
  "loginMethod" varchar(64),
  "role" "role" DEFAULT 'user' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "lastSignedIn" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
