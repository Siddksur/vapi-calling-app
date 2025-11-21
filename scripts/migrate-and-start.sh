#!/bin/bash
set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy || echo "⚠️ Migration failed or already applied, continuing..."

echo "🚀 Starting application..."
exec npm start

