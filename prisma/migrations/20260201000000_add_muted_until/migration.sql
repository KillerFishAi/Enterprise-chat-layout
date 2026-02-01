-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN IF NOT EXISTS "mutedUntil" TIMESTAMP(3);
