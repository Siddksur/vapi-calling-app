#!/usr/bin/env node

/**
 * Helper script to list assistants and phone numbers.
 * Usage:
 *   npm run list-resources
 */

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

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

async function listAssistants(pool) {
    const result = await pool.query(`
        SELECT id, name, description, is_active, created_at, updated_at
        FROM assistants
        ORDER BY name ASC
    `);
    return result.rows;
}

async function listPhoneNumbers(pool) {
    const result = await pool.query(`
        SELECT id, display_name, phone_number, is_active, created_at, updated_at
        FROM phone_numbers
        ORDER BY display_name ASC
    `);
    return result.rows;
}

async function main() {
    const pool = createPool();

    try {
        const [assistants, phoneNumbers] = await Promise.all([
            listAssistants(pool),
            listPhoneNumbers(pool)
        ]);

        console.log('📚 Assistants:');
        if (assistants.length === 0) {
            console.log('   (none saved yet)');
        } else {
            assistants.forEach(item => {
                console.log(`   • ${item.name} (${item.id})${item.is_active ? '' : ' [inactive]'}`);
            });
        }

        console.log('\n☎️ Phone Numbers:');
        if (phoneNumbers.length === 0) {
            console.log('   (none saved yet)');
        } else {
            phoneNumbers.forEach(item => {
                const label = item.display_name || item.phone_number || item.id;
                const numberText = item.phone_number ? ` - ${item.phone_number}` : '';
                console.log(`   • ${label} (${item.id})${numberText}${item.is_active ? '' : ' [inactive]'}`);
            });
        }
    } catch (error) {
        console.error('❌ Error listing resources:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

