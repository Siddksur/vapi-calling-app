-- Add vapiCustomVariables to Tenant table
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "vapi_custom_variables" JSONB;
