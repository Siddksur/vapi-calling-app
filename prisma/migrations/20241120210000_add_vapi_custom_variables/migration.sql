-- Add vapiCustomVariables to tenants table
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "vapi_custom_variables" JSONB;

