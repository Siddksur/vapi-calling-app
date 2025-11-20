#!/usr/bin/env node

/**
 * Helper script to remove an assistant or phone number record.
 * Usage:
 *   npm run remove-resource -- --type assistant --id <assistant-id>
 *   npm run remove-resource -- --type phone --id <phone-id>
 *   npm run remove-resource -- --type assistant --id <assistant-id> --force (to remove even if used in campaigns)
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

async function checkAssistantExists(pool, id) {
    const result = await pool.query('SELECT id, name FROM assistants WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function checkPhoneNumberExists(pool, id) {
    const result = await pool.query('SELECT id, display_name FROM phone_numbers WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function checkAssistantUsage(pool, id) {
    const campaignsResult = await pool.query(
        'SELECT COUNT(*) as count FROM campaigns WHERE assistant_id = $1',
        [id]
    );
    const callsResult = await pool.query(
        'SELECT COUNT(*) as count FROM calls WHERE assistant_id = $1',
        [id]
    );
    
    return {
        campaigns: parseInt(campaignsResult.rows[0].count),
        calls: parseInt(callsResult.rows[0].count)
    };
}

async function checkPhoneNumberUsage(pool, id) {
    const campaignsResult = await pool.query(
        'SELECT COUNT(*) as count FROM campaigns WHERE phone_number_id = $1',
        [id]
    );
    const callsResult = await pool.query(
        'SELECT COUNT(*) as count FROM calls WHERE phone_number_id = $1',
        [id]
    );
    
    return {
        campaigns: parseInt(campaignsResult.rows[0].count),
        calls: parseInt(callsResult.rows[0].count)
    };
}

async function removeAssistant(pool, id, force) {
    // Check if assistant exists
    const assistant = await checkAssistantExists(pool, id);
    if (!assistant) {
        console.error(`❌ Assistant with ID "${id}" not found.`);
        process.exit(1);
    }

    console.log(`📋 Found assistant: ${assistant.name} (${id})`);

    // Check usage
    const usage = await checkAssistantUsage(pool, id);
    
    if (usage.campaigns > 0 || usage.calls > 0) {
        console.log(`⚠️  This assistant is referenced in:`);
        console.log(`   - ${usage.campaigns} campaign(s)`);
        console.log(`   - ${usage.calls} call record(s)`);
        
        if (!force) {
            console.error('\n❌ Cannot remove assistant that is in use. Use --force to remove anyway.');
            console.log('   Note: Using --force will break foreign key relationships.');
            process.exit(1);
        } else {
            console.log('⚠️  Proceeding with force removal...');
        }
    }

    // Remove from campaigns first if force is enabled
    if (force && usage.campaigns > 0) {
        await pool.query('DELETE FROM campaigns WHERE assistant_id = $1', [id]);
        console.log(`   ✅ Removed ${usage.campaigns} campaign reference(s)`);
    }

    // Remove the assistant
    await pool.query('DELETE FROM assistants WHERE id = $1', [id]);
    console.log(`✅ Assistant "${assistant.name}" removed successfully.`);
}

async function removePhoneNumber(pool, id, force) {
    // Check if phone number exists
    const phoneNumber = await checkPhoneNumberExists(pool, id);
    if (!phoneNumber) {
        console.error(`❌ Phone number with ID "${id}" not found.`);
        process.exit(1);
    }

    console.log(`📋 Found phone number: ${phoneNumber.display_name} (${id})`);

    // Check usage
    const usage = await checkPhoneNumberUsage(pool, id);
    
    if (usage.campaigns > 0 || usage.calls > 0) {
        console.log(`⚠️  This phone number is referenced in:`);
        console.log(`   - ${usage.campaigns} campaign(s)`);
        console.log(`   - ${usage.calls} call record(s)`);
        
        if (!force) {
            console.error('\n❌ Cannot remove phone number that is in use. Use --force to remove anyway.');
            console.log('   Note: Using --force will break foreign key relationships.');
            process.exit(1);
        } else {
            console.log('⚠️  Proceeding with force removal...');
        }
    }

    // Remove from campaigns first if force is enabled
    if (force && usage.campaigns > 0) {
        await pool.query('DELETE FROM campaigns WHERE phone_number_id = $1', [id]);
        console.log(`   ✅ Removed ${usage.campaigns} campaign reference(s)`);
    }

    // Remove the phone number
    await pool.query('DELETE FROM phone_numbers WHERE id = $1', [id]);
    console.log(`✅ Phone number "${phoneNumber.display_name}" removed successfully.`);
}

async function main() {
    const args = parseArgs();

    if (!args.type || !args.id) {
        console.error('❌ Missing required arguments.');
        console.log('Usage: npm run remove-resource -- --type <assistant|phone> --id <resource-id> [--force]');
        process.exit(1);
    }

    const type = args.type.toLowerCase();
    if (type !== 'assistant' && type !== 'phone') {
        console.error('❌ Invalid type. Must be "assistant" or "phone".');
        process.exit(1);
    }

    const pool = createPool();
    const force = args.force === true;

    try {
        if (type === 'assistant') {
            await removeAssistant(pool, args.id, force);
        } else {
            await removePhoneNumber(pool, args.id, force);
        }
    } catch (error) {
        if (error.code === '23503') { // Foreign key violation
            console.error('❌ Cannot remove: This resource is still referenced by other records.');
            console.error('   Use --force to remove anyway (this may break relationships).');
        } else {
            console.error('❌ Error removing resource:', error.message);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

