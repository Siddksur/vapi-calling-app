-- AlterTable
ALTER TABLE "assistants" ADD COLUMN IF NOT EXISTS "system_prompt" TEXT,
ADD COLUMN IF NOT EXISTS "first_message" TEXT;

