-- Create ConnectedAccount table
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "microsoftAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- Backfill: create one ConnectedAccount per existing User (email is the Microsoft account email)
INSERT INTO "ConnectedAccount" ("id", "appUserId", "microsoftAccountId", "email", "displayName", "isActive")
SELECT
    'ca_' || "User"."id",
    "User"."id",
    'legacy_' || "User"."id",
    "User"."email",
    "User"."displayName",
    true
FROM "User";

-- Add connectedAccountId to ProcessedEmail (nullable first, then backfill, then NOT NULL)
ALTER TABLE "ProcessedEmail" ADD COLUMN "connectedAccountId" TEXT;

UPDATE "ProcessedEmail"
SET "connectedAccountId" = 'ca_' || "ProcessedEmail"."userId"
WHERE "connectedAccountId" IS NULL;

ALTER TABLE "ProcessedEmail" ALTER COLUMN "connectedAccountId" SET NOT NULL;

-- Add connectedAccountId to Meeting
ALTER TABLE "Meeting" ADD COLUMN "connectedAccountId" TEXT;

UPDATE "Meeting"
SET "connectedAccountId" = 'ca_' || "ProcessedEmail"."userId"
FROM "ProcessedEmail"
WHERE "Meeting"."emailId" = "ProcessedEmail"."id";

ALTER TABLE "Meeting" ALTER COLUMN "connectedAccountId" SET NOT NULL;

-- Add connectedAccountId to Deadline
ALTER TABLE "Deadline" ADD COLUMN "connectedAccountId" TEXT;

UPDATE "Deadline"
SET "connectedAccountId" = 'ca_' || "Deadline"."userId"
WHERE "connectedAccountId" IS NULL;

ALTER TABLE "Deadline" ALTER COLUMN "connectedAccountId" SET NOT NULL;

-- Add connectedAccountId to ActionItem
ALTER TABLE "ActionItem" ADD COLUMN "connectedAccountId" TEXT;

UPDATE "ActionItem"
SET "connectedAccountId" = 'ca_' || "ProcessedEmail"."userId"
FROM "ProcessedEmail"
WHERE "ActionItem"."emailId" = "ProcessedEmail"."id";

ALTER TABLE "ActionItem" ALTER COLUMN "connectedAccountId" SET NOT NULL;

-- Foreign keys
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessedEmail" ADD CONSTRAINT "ProcessedEmail_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "ConnectedAccount_appUserId_isActive_idx" ON "ConnectedAccount"("appUserId", "isActive");
CREATE INDEX "ConnectedAccount_appUserId_idx" ON "ConnectedAccount"("appUserId");
CREATE UNIQUE INDEX "ConnectedAccount_microsoftAccountId_key" ON "ConnectedAccount"("microsoftAccountId");

CREATE INDEX "ProcessedEmail_connectedAccountId_processedAt_idx" ON "ProcessedEmail"("connectedAccountId", "processedAt");
CREATE INDEX "Meeting_connectedAccountId_idx" ON "Meeting"("connectedAccountId");
CREATE INDEX "Deadline_connectedAccountId_status_dueDate_idx" ON "Deadline"("connectedAccountId", "status", "dueDate");
CREATE INDEX "ActionItem_connectedAccountId_idx" ON "ActionItem"("connectedAccountId");