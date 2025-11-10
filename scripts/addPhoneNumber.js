#!/usr/bin/env node

/**
 * Helper script to add or update a phone number record.
 * Usage:
 *   npm run add-phone -- --id <phone-id> --displayName "Friendly Name" [--number "+16475551234"] [--inactive]
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

async function upsertPhoneNumber(pool, { id, displayName, rawNumber, isActive }) {
    const query = `
        INSERT INTO phone_numbers (id, display_name, phone_number, is_active, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            phone_number = EXCLUDED.phone_number,
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [id, displayName, rawNumber || null, isActive]);
}

async function main() {
    const args = parseArgs();

    if (!args.id || !args.displayName) {
        console.error('❌ Missing required arguments.');
        console.log('Usage: npm run add-phone -- --id <phone-id> --displayName "Friendly Name" [--number "+16475551234"] [--inactive]');
        process.exit(1);
    }

    const pool = createPool();

    const record = {
        id: args.id,
        displayName: args.displayName,
        rawNumber: args.number || null,
        isActive: args.inactive ? false : true
    };

    try {
        await upsertPhoneNumber(pool, record);
        console.log('✅ Phone number saved successfully:');
        console.log(`   ID: ${record.id}`);
        console.log(`   Display Name: ${record.displayName}`);
        if (record.rawNumber) {
            console.log(`   Number: ${record.rawNumber}`);
        }
        console.log(`   Active: ${record.isActive ? 'yes' : 'no'}`);
    } catch (error) {
        console.error('❌ Error saving phone number:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

