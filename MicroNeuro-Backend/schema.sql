-- Consolidated PostgreSQL backup for the Prisma schema.
-- Prisma's cuid() values are application-generated. This SQL backup uses
-- pgcrypto text IDs so manually-created rows also have a safe default.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL UNIQUE,
  "displayName" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ProcessedEmail" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "graphMessageId" TEXT NOT NULL UNIQUE,
  "subject" TEXT,
  "fromAddress" TEXT,
  "receivedAt" TIMESTAMPTZ NOT NULL,
  "processedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "emailType" TEXT
);

CREATE TABLE "Meeting" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "emailId" TEXT NOT NULL REFERENCES "ProcessedEmail"("id") ON DELETE CASCADE,
  "subject" TEXT NOT NULL,
  "date" TIMESTAMPTZ,
  "time" TEXT,
  "participants" TEXT[] NOT NULL DEFAULT '{}',
  "agenda" TEXT,
  "momStatus" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE "Deadline" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "emailId" TEXT REFERENCES "ProcessedEmail"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "description" TEXT NOT NULL,
  "dueDate" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'upcoming'
);

CREATE TABLE "ActionItem" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "emailId" TEXT NOT NULL REFERENCES "ProcessedEmail"("id") ON DELETE CASCADE,
  "description" TEXT NOT NULL,
  "owner" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE "Alert" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Settings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "alertLeadTimeHours" INTEGER NOT NULL DEFAULT 24,
  "foldersToScan" TEXT[] NOT NULL DEFAULT ARRAY['inbox']::TEXT[],
  "notifyByEmail" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "WebhookSubscription" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "graphSubscriptionId" TEXT NOT NULL UNIQUE,
  "resource" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ProcessedEmail_userId_processedAt_idx" ON "ProcessedEmail" ("userId", "processedAt");
CREATE INDEX "Meeting_emailId_idx" ON "Meeting" ("emailId");
CREATE INDEX "Deadline_status_dueDate_idx" ON "Deadline" ("status", "dueDate");
CREATE INDEX "Deadline_emailId_idx" ON "Deadline" ("emailId");
CREATE INDEX "Deadline_userId_status_dueDate_idx" ON "Deadline" ("userId", "status", "dueDate");
CREATE INDEX "ActionItem_status_idx" ON "ActionItem" ("status");
CREATE INDEX "ActionItem_emailId_idx" ON "ActionItem" ("emailId");
CREATE INDEX "Alert_userId_isRead_createdAt_idx" ON "Alert" ("userId", "isRead", "createdAt");
CREATE INDEX "Alert_sourceType_sourceId_isRead_idx" ON "Alert" ("sourceType", "sourceId", "isRead");
CREATE INDEX "WebhookSubscription_expiresAt_idx" ON "WebhookSubscription" ("expiresAt");
CREATE INDEX "WebhookSubscription_userId_idx" ON "WebhookSubscription" ("userId");