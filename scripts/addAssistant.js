#!/usr/bin/env node

/**
 * Helper script to add or update an assistant record.
 * Usage:
 *   npm run add-assistant -- --id <assistant-id> --name "Friendly Name" [--description "optional"] [--inactive]
 */

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function parseArgs() {
    const args = {};
    const rawArgs = process.argv.slice(2);

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextValue = rawArgs[i + 1];
            if (!nextValue || nextValue.startsWith('--')) {
                args[key] = true;
            } else {
                args[key] = nextValue;
                i++;
            }
        }
    }

    return args;
}

function createPool() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('❌ DATABASE_URL is not set. Add it to your Railway environment variables or local .env file.');
        process.exit(1);
    }

    const useSSL = !connectionString.includes('localhost');
    return new Pool({
        connectionString,
        ssl: useSSL ? { rejectUnauthorized: false } : false
    });
}

async function upsertAssistant(pool, { id, name, description, isActive }) {
    const query = `
        INSERT INTO assistants (id, name, description, is_active, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [id, name, description || null, isActive]);
}

async function main() {
    const args = parseArgs();

    if (!args.id || !args.name) {
        console.error('❌ Missing required arguments.');
        console.log('Usage: npm run add-assistant -- --id <assistant-id> --name "Friendly Name" [--description "optional"] [--inactive]');
        process.exit(1);
    }

    const pool = createPool();

    const assistantRecord = {
        id: args.id,
        name: args.name,
        description: args.description || null,
        isActive: args.inactive ? false : true
    };

    try {
        await upsertAssistant(pool, assistantRecord);
        console.log('✅ Assistant saved successfully:');
        console.log(`   ID: ${assistantRecord.id}`);
        console.log(`   Name: ${assistantRecord.name}`);
        if (assistantRecord.description) {
            console.log(`   Description: ${assistantRecord.description}`);
        }
        console.log(`   Active: ${assistantRecord.isActive ? 'yes' : 'no'}`);
    } catch (error) {
        console.error('❌ Error saving assistant:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

