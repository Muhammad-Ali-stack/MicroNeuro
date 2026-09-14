-- Make Deadline emailId optional and add a required userId back-reference.
ALTER TABLE "Deadline" ALTER COLUMN "emailId" DROP NOT NULL;

ALTER TABLE "Deadline" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';

-- Backfill userId for existing rows via their ProcessedEmail relation.
UPDATE "Deadline"
SET "userId" = "ProcessedEmail"."userId"
FROM "ProcessedEmail"
WHERE "Deadline"."emailId" = "ProcessedEmail"."id";

-- Drop the temporary default after backfill.
ALTER TABLE "Deadline" ALTER COLUMN "userId" DROP DEFAULT;

-- Add the FK and composite index.
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Deadline_userId_status_dueDate_idx" ON "Deadline"("userId", "status", "dueDate");