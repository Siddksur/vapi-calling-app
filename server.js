const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const cookieSession = require('cookie-session');
const { Pool } = require('pg'); // PostgreSQL connection pool
require('dotenv').config();

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure secure cookies work behind Railway's proxy
app.set('trust proxy', 1);

const LOGIN_USERNAME = process.env.APP_LOGIN_USERNAME;
const LOGIN_PASSWORD = process.env.APP_LOGIN_PASSWORD;
const SESSION_SECRET = process.env.APP_SESSION_SECRET;

const normalizeSecret = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const EXPECTED_USERNAME = normalizeSecret(LOGIN_USERNAME);
const EXPECTED_PASSWORD = normalizeSecret(LOGIN_PASSWORD);

if (!SESSION_SECRET) {
    console.warn('⚠️ APP_SESSION_SECRET is not set. Using an insecure fallback value. Set this env var in production.');
}

if (!LOGIN_USERNAME || !LOGIN_PASSWORD) {
    console.warn('⚠️ APP_LOGIN_USERNAME or APP_LOGIN_PASSWORD missing. Login will not work until both are set.');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieSession({
    name: 'appSession',
    secret: SESSION_SECRET || 'change-me',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// NEW: PostgreSQL Database setup
// Railway automatically provides DATABASE_URL when PostgreSQL is linked to your service
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Test connection, initialize database, and rehydrate scheduled calls
pool.connect()
    .then(async client => {
        console.log('✅ Connected to PostgreSQL database');
        client.release();
        try {
            await initializeDatabase();
            await rehydrateScheduledCalls();
        } catch (err) {
            console.error('❌ Error during startup tasks:', err);
        }
    })
    .catch(err => {
        console.error('❌ Error acquiring database client:', err.message);
        console.error('⚠️ Make sure DATABASE_URL is set in Railway environment variables');
        console.error('⚠️ If deploying to Railway, make sure PostgreSQL service is linked to your app');
    });

// NEW: Initialize database tables (PostgreSQL)
async function initializeDatabase() {
    try {
        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'calls'
            )
        `);
        
        if (tableCheck.rows[0].exists) {
            // Table exists - just run migrations to add any missing columns
            console.log('✅ Database table already exists - running migrations');
            await addRetryColumnsIfNotExist();
            await addCallAssociationColumnsIfNotExist();
        } else {
            // Table doesn't exist - create it
            console.log('📋 Creating new calls table');
            await pool.query(`
                CREATE TABLE calls (
                    id SERIAL PRIMARY KEY,
                    contact_name VARCHAR(255) NOT NULL,
                    contact_phone VARCHAR(50) NOT NULL,
                    contact_address TEXT,
                    call_id VARCHAR(255),
                    status VARCHAR(50) DEFAULT 'scheduled',
                    scheduled_time TIMESTAMP,
                    scheduled_time_local VARCHAR(50),
                    ended_reason VARCHAR(255),
                    call_outcome VARCHAR(255),
                    duration NUMERIC(10, 2),
                    cost NUMERIC(10, 4),
                    success_evaluation VARCHAR(50),
                    structured_data JSONB,
                    summary TEXT,
                    recording_url TEXT,
                    actual_call_time VARCHAR(50),
                    message TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    campaign_id VARCHAR(255),
                    index_position INTEGER,
                    outcome_received BOOLEAN DEFAULT FALSE,
                    is_retry BOOLEAN DEFAULT FALSE,
                    original_call_id VARCHAR(255),
                    retry_count INTEGER DEFAULT 0,
                    assistant_id VARCHAR(255),
                    phone_number_id VARCHAR(255)
                )
            `);
            console.log('✅ Database table created with all columns');
            await addRetryColumnsIfNotExist();
            await addCallAssociationColumnsIfNotExist();
        }

        await ensureSupportTables();
    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
    }
}

// NEW: Add retry columns to existing database (migration helper)
async function addRetryColumnsIfNotExist() {
    const columns = [
        { name: 'is_retry', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'original_call_id', type: 'VARCHAR(255)' },
        { name: 'retry_count', type: 'INTEGER DEFAULT 0' },
        { name: 'recording_url', type: 'TEXT' },
        { name: 'structured_data', type: 'JSONB' }
    ];
    
    for (const column of columns) {
        try {
            // Check if column exists
            const columnCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'calls' 
                    AND column_name = $1
                )
            `, [column.name]);
            
            if (!columnCheck.rows[0].exists) {
                await pool.query(`ALTER TABLE calls ADD COLUMN ${column.name} ${column.type}`);
                console.log(`✅ Added column: ${column.name}`);
            }
        } catch (err) {
            if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
                console.error(`❌ Error adding column ${column.name}:`, err.message);
            }
        }
    }
}

// NEW: Add assistant/phone number columns to calls table if missing
async function addCallAssociationColumnsIfNotExist() {
    const columns = [
        { name: 'assistant_id', type: 'VARCHAR(255)' },
        { name: 'phone_number_id', type: 'VARCHAR(255)' }
    ];

    for (const column of columns) {
        try {
            const columnCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'calls'
                    AND column_name = $1
                )
            `, [column.name]);

            if (!columnCheck.rows[0].exists) {
                await pool.query(`ALTER TABLE calls ADD COLUMN ${column.name} ${column.type}`);
                console.log(`✅ Added column: ${column.name}`);
            }
        } catch (err) {
            if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
                console.error(`❌ Error adding column ${column.name}:`, err.message);
            }
        }
    }
}

// NEW: Ensure support tables exist
async function ensureSupportTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS assistants (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS phone_numbers (
                id VARCHAR(255) PRIMARY KEY,
                display_name VARCHAR(255) NOT NULL,
                phone_number VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS campaigns (
                id VARCHAR(255) PRIMARY KEY,
                assistant_id VARCHAR(255) NOT NULL REFERENCES assistants(id),
                phone_number_id VARCHAR(255) NOT NULL REFERENCES phone_numbers(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP NULL
            )
        `);

        // Add deleted_at column if it doesn't exist (migration)
        try {
            await pool.query(`
                ALTER TABLE campaigns 
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL
            `);
        } catch (err) {
            // Column might already exist, ignore
        }

        // Create indexes for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at 
            ON campaigns(deleted_at) 
            WHERE deleted_at IS NULL
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_calls_campaign_id 
            ON calls(campaign_id)
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS webhook_config (
                id SERIAL PRIMARY KEY,
                webhook_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Support tables verified');
    } catch (err) {
        console.error('❌ Error ensuring support tables:', err.message);
        throw err;
    }
}


// VAPI Configuration using environment variables
const VAPI_CONFIG = {
    privateKey: process.env.VAPI_PRIVATE_KEY,
    organizationId: process.env.VAPI_ORGANIZATION_ID,
    assistantId: process.env.VAPI_ASSISTANT_ID,
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    baseUrl: 'https://api.vapi.ai'
};

// UPDATED: Call queue and scheduling management (still use memory for active operations)
const CALL_SYSTEM = {
    activeCalls: 0,
    maxConcurrent: 10,
    pendingCalls: [],
    timers: [],
    retryTimers: [], // NEW: Track retry timers
    currentCampaignId: null, // NEW: Track current campaign
    currentAssistantId: null, // NEW: Track assistant for active campaign
    currentPhoneNumberId: null // NEW: Track phone number for active campaign
};

// NEW: Database helper functions (PostgreSQL)
const DB_HELPERS = {
    // Fetch all assistants
    getAssistants: async () => {
        try {
            const result = await pool.query(`
                SELECT id, name, description, is_active
                FROM assistants
                WHERE is_active = TRUE
                ORDER BY name ASC
            `);
            return result.rows;
        } catch (err) {
            console.error('❌ Error fetching assistants:', err);
            return [];
        }
    },

    // Fetch all phone numbers
    getPhoneNumbers: async () => {
        try {
            const result = await pool.query(`
                SELECT id, display_name, phone_number, is_active
                FROM phone_numbers
                WHERE is_active = TRUE
                ORDER BY display_name ASC
            `);
            return result.rows;
        } catch (err) {
            console.error('❌ Error fetching phone numbers:', err);
            return [];
        }
    },

    // Fetch single assistant
    getAssistantById: async (assistantId) => {
        try {
            const result = await pool.query(`
                SELECT id, name, description, is_active
                FROM assistants
                WHERE id = $1
            `, [assistantId]);
            return result.rows[0] || null;
        } catch (err) {
            console.error('❌ Error fetching assistant by id:', err);
            return null;
        }
    },

    // Fetch single phone number
    getPhoneNumberById: async (phoneNumberId) => {
        try {
            const result = await pool.query(`
                SELECT id, display_name, phone_number, is_active
                FROM phone_numbers
                WHERE id = $1
            `, [phoneNumberId]);
            return result.rows[0] || null;
        } catch (err) {
            console.error('❌ Error fetching phone number by id:', err);
            return null;
        }
    },

    // Create campaign metadata
    createCampaign: async (campaignId, assistantId, phoneNumberId) => {
        try {
            await pool.query(`
                INSERT INTO campaigns (id, assistant_id, phone_number_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET
                    assistant_id = EXCLUDED.assistant_id,
                    phone_number_id = EXCLUDED.phone_number_id
            `, [campaignId, assistantId, phoneNumberId]);
        } catch (err) {
            console.error('❌ Error creating campaign record:', err);
            throw err;
        }
    },

    // Fetch campaign metadata
    getCampaignById: async (campaignId) => {
        try {
            const result = await pool.query(`
                SELECT c.id, c.assistant_id, c.phone_number_id,
                       a.name AS assistant_name,
                       p.display_name AS phone_number_name
                FROM campaigns c
                LEFT JOIN assistants a ON a.id = c.assistant_id
                LEFT JOIN phone_numbers p ON p.id = c.phone_number_id
                WHERE c.id = $1
            `, [campaignId]);
            return result.rows[0] || null;
        } catch (err) {
            console.error('❌ Error fetching campaign metadata:', err);
            return null;
        }
    },

    // Save a call to database (supports retry calls)
    saveCall: async (callData, callback) => {
        try {
            const result = await pool.query(`
                INSERT INTO calls (
                    contact_name, contact_phone, contact_address, call_id, status,
                    scheduled_time, scheduled_time_local, message, timestamp,
                    campaign_id, index_position, is_retry, original_call_id, retry_count,
                    assistant_id, phone_number_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING id
            `, [
                callData.contact.name,
                formatPhoneNumber(callData.contact.phone),
                callData.contact.address || '',
                callData.callId || null,
                callData.status,
                callData.scheduledTime || null,
                callData.scheduledTimeLocal || null,
                callData.message || '',
                callData.timestamp || new Date().toISOString(),
                callData.campaignId || CALL_SYSTEM.currentCampaignId,
                callData.index !== undefined ? callData.index : null,
                callData.isRetry || false,
                callData.originalCallId || null,
                callData.retryCount || 0,
                callData.assistantId || CALL_SYSTEM.currentAssistantId || VAPI_CONFIG.assistantId,
                callData.phoneNumberId || CALL_SYSTEM.currentPhoneNumberId || VAPI_CONFIG.phoneNumberId
            ]);
            
            if (callback) callback(null, result.rows[0].id);
        } catch (err) {
            console.error('❌ Error saving call:', err);
            if (callback) callback(err, null);
        }
    },
    
    // Update call with outcome data
    updateCallOutcome: async (callId, outcomeData, callback) => {
        try {
            await pool.query(`
                UPDATE calls SET 
                    ended_reason = $1, call_outcome = $2, duration = $3, cost = $4,
                    success_evaluation = $5, structured_data = $6, summary = $7,
                    actual_call_time = $8, status = $9, outcome_received = $10,
                    message = $11, recording_url = $12
                WHERE call_id = $13
            `, [
                outcomeData.endedReason,
                outcomeData.callOutcome,
                outcomeData.duration,
                outcomeData.cost,
                outcomeData.successEvaluation,
                outcomeData.structuredData ? JSON.stringify(outcomeData.structuredData) : null,
                outcomeData.summary,
                outcomeData.actualCallTime,
                'completed',
                true, // outcome_received
                outcomeData.message,
                outcomeData.recordingUrl,
                callId
            ]);
            
            if (callback) callback(null);
        } catch (err) {
            console.error('❌ Error updating call outcome:', err);
            if (callback) callback(err);
        }
    },
    
    // Get all calls for current campaign
    getCurrentCalls: async (callback) => {
        try {
            const result = await pool.query(`
                SELECT * FROM calls 
                WHERE campaign_id = $1 
                ORDER BY index_position NULLS LAST
            `, [CALL_SYSTEM.currentCampaignId]);
            
            // Convert database rows back to our format
            const calls = result.rows.map(row => ({
                id: row.id, // Database ID for manual operations
                contact: {
                    name: row.contact_name,
                    phone: row.contact_phone,
                    address: row.contact_address
                },
                assistantId: row.assistant_id,
                phoneNumberId: row.phone_number_id,
                callId: row.call_id,
                status: row.status,
                scheduledTime: row.scheduled_time ? row.scheduled_time.toISOString() : null,
                scheduledTimeLocal: row.scheduled_time_local,
                endedReason: row.ended_reason,
                callOutcome: row.call_outcome,
                duration: row.duration ? parseFloat(row.duration) : null,
                cost: row.cost ? parseFloat(row.cost) : null,
                successEvaluation: row.success_evaluation,
                structuredData: row.structured_data || null,
                summary: row.summary,
                recordingUrl: row.recording_url,
                actualCallTime: row.actual_call_time,
                message: row.message,
                timestamp: row.timestamp ? row.timestamp.toISOString() : null,
                index: row.index_position,
                outcomeReceived: row.outcome_received || false,
                success: row.success_evaluation === 'Pass',
                isRetry: row.is_retry || false,
                originalCallId: row.original_call_id,
                retryCount: row.retry_count || 0
            }));
            
            callback(null, calls);
        } catch (err) {
            console.error('❌ Error fetching calls:', err);
            callback(err, []);
        }
    },
    
    // Get all calls for a specific campaign ID
    getCallsForCampaign: async (campaignId, callback) => {
        try {
            const result = await pool.query(`
                SELECT * FROM calls 
                WHERE campaign_id = $1 
                ORDER BY index_position NULLS LAST
            `, [campaignId]);
            
            // Convert database rows back to our format
            const calls = result.rows.map(row => ({
                id: row.id, // Database ID for manual operations
                contact: {
                    name: row.contact_name,
                    phone: row.contact_phone,
                    address: row.contact_address
                },
                assistantId: row.assistant_id,
                phoneNumberId: row.phone_number_id,
                callId: row.call_id,
                status: row.status,
                scheduledTime: row.scheduled_time ? row.scheduled_time.toISOString() : null,
                scheduledTimeLocal: row.scheduled_time_local,
                endedReason: row.ended_reason,
                callOutcome: row.call_outcome,
                duration: row.duration ? parseFloat(row.duration) : null,
                cost: row.cost ? parseFloat(row.cost) : null,
                successEvaluation: row.success_evaluation,
                structuredData: row.structured_data || null,
                summary: row.summary,
                recordingUrl: row.recording_url,
                actualCallTime: row.actual_call_time,
                message: row.message,
                timestamp: row.timestamp ? row.timestamp.toISOString() : null,
                index: row.index_position,
                outcomeReceived: row.outcome_received || false,
                success: row.success_evaluation === 'Pass',
                isRetry: row.is_retry || false,
                originalCallId: row.original_call_id,
                retryCount: row.retry_count || 0
            }));
            
            callback(null, calls);
        } catch (err) {
            console.error('❌ Error fetching calls for campaign:', err);
            callback(err, []);
        }
    },
    
    // Get all campaigns with metadata
    getAllCampaigns: async (callback) => {
        try {
            const result = await pool.query(`
                WITH call_stats AS (
                    SELECT 
                        campaign_id,
                        COUNT(*) AS call_count,
                        MIN(timestamp) AS created_at,
                        MAX(timestamp) AS last_updated,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
                        SUM(CASE WHEN success_evaluation = 'Pass' THEN 1 ELSE 0 END) AS successful_count
                    FROM calls
                    WHERE campaign_id IS NOT NULL
                    GROUP BY campaign_id
                )
                SELECT 
                    c.id AS campaign_id,
                    c.assistant_id,
                    c.phone_number_id,
                    c.created_at AS campaign_created_at,
                    a.name AS assistant_name,
                    p.display_name AS phone_number_name,
                    cs.call_count,
                    cs.created_at,
                    cs.last_updated,
                    cs.completed_count,
                    cs.successful_count
                FROM campaigns c
                LEFT JOIN call_stats cs ON cs.campaign_id = c.id
                LEFT JOIN assistants a ON a.id = c.assistant_id
                LEFT JOIN phone_numbers p ON p.id = c.phone_number_id
                WHERE c.deleted_at IS NULL
                ORDER BY COALESCE(cs.last_updated, c.created_at) DESC
            `);
            
            const campaigns = result.rows.map(row => ({
                campaignId: row.campaign_id,
                callCount: row.call_count ? parseInt(row.call_count) : 0,
                createdAt: row.created_at ? row.created_at.toISOString() : (row.campaign_created_at ? row.campaign_created_at.toISOString() : null),
                lastUpdated: row.last_updated ? row.last_updated.toISOString() : null,
                completedCount: row.completed_count ? parseInt(row.completed_count) : 0,
                successfulCount: row.successful_count ? parseInt(row.successful_count) : 0,
                assistantId: row.assistant_id,
                assistantName: row.assistant_name,
                phoneNumberId: row.phone_number_id,
                phoneNumberName: row.phone_number_name
            }));
            
            callback(null, campaigns);
        } catch (err) {
            console.error('❌ Error fetching campaigns:', err);
            callback(err, []);
        }
    },
    
    // Get call by callId (for retry functionality)
    getCallByCallId: async (callId, callback) => {
        try {
            const result = await pool.query(`
                SELECT * FROM calls 
                WHERE call_id = $1
                ORDER BY timestamp DESC
                LIMIT 1
            `, [callId]);
            
            if (result.rows.length === 0) {
                callback(null, null);
                return;
            }
            
            const row = result.rows[0];
            
            // Convert database row to our format
            const call = {
                id: row.id,
                contact: {
                    name: row.contact_name,
                    phone: row.contact_phone,
                    address: row.contact_address
                },
                assistantId: row.assistant_id,
                phoneNumberId: row.phone_number_id,
                callId: row.call_id,
                status: row.status,
                scheduledTime: row.scheduled_time ? row.scheduled_time.toISOString() : null,
                scheduledTimeLocal: row.scheduled_time_local,
                endedReason: row.ended_reason,
                callOutcome: row.call_outcome,
                duration: row.duration ? parseFloat(row.duration) : null,
                cost: row.cost ? parseFloat(row.cost) : null,
                successEvaluation: row.success_evaluation,
                structuredData: row.structured_data || null,
                summary: row.summary,
                recordingUrl: row.recording_url,
                actualCallTime: row.actual_call_time,
                message: row.message,
                timestamp: row.timestamp ? row.timestamp.toISOString() : null,
                campaignId: row.campaign_id,
                index: row.index_position,
                outcomeReceived: row.outcome_received || false,
                success: row.success_evaluation === 'Pass',
                isRetry: row.is_retry || false,
                originalCallId: row.original_call_id,
                retryCount: row.retry_count || 0
            };
            
            callback(null, call);
        } catch (err) {
            console.error('❌ Error fetching call by callId:', err);
            callback(err, null);
        }
    },
    
    // Get call by database ID (for manual lead operations)
    getCallByDatabaseId: async (dbId, callback) => {
        try {
            const result = await pool.query(`
                SELECT * FROM calls 
                WHERE id = $1
            `, [dbId]);
            
            if (result.rows.length === 0) {
                callback(null, null);
                return;
            }
            
            const row = result.rows[0];
            
            // Convert database row to our format
            const call = {
                id: row.id,
                contact: {
                    name: row.contact_name,
                    phone: row.contact_phone,
                    address: row.contact_address
                },
                assistantId: row.assistant_id,
                phoneNumberId: row.phone_number_id,
                callId: row.call_id,
                status: row.status,
                scheduledTime: row.scheduled_time ? row.scheduled_time.toISOString() : null,
                scheduledTimeLocal: row.scheduled_time_local,
                endedReason: row.ended_reason,
                callOutcome: row.call_outcome,
                duration: row.duration ? parseFloat(row.duration) : null,
                cost: row.cost ? parseFloat(row.cost) : null,
                successEvaluation: row.success_evaluation,
                structuredData: row.structured_data || null,
                summary: row.summary,
                recordingUrl: row.recording_url,
                actualCallTime: row.actual_call_time,
                message: row.message,
                timestamp: row.timestamp ? row.timestamp.toISOString() : null,
                campaignId: row.campaign_id,
                index: row.index_position,
                outcomeReceived: row.outcome_received || false,
                success: row.success_evaluation === 'Pass',
                isRetry: row.is_retry || false,
                originalCallId: row.original_call_id,
                retryCount: row.retry_count || 0
            };
            
            callback(null, call);
        } catch (err) {
            console.error('❌ Error fetching call by database ID:', err);
            callback(err, null);
        }
    },
    
    // Update retry count for original call
    updateRetryCount: async (originalCallId, callback) => {
        try {
            const result = await pool.query(`
                UPDATE calls SET retry_count = retry_count + 1
                WHERE call_id = $1
            `, [originalCallId]);
            
            if (callback) callback(null, result.rowCount);
        } catch (err) {
            console.error('❌ Error updating retry count:', err);
            if (callback) callback(err, 0);
        }
    },
    
    // Clear old campaign data (optional - for cleanup)
    clearOldCampaigns: async (daysOld = 7) => {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            const result = await pool.query(`
                DELETE FROM calls 
                WHERE timestamp < $1 
                AND status IN ('completed', 'cancelled', 'failed')
            `, [cutoffDate.toISOString()]);
            
            if (result.rowCount > 0) {
                console.log(`🧹 Cleaned up ${result.rowCount} old call records`);
            }
        } catch (err) {
            console.error('❌ Error clearing old campaigns:', err);
        }
    }
};

// Function to format phone number to E.164 format
function formatPhoneNumber(phone) {
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length === 10) {
        return `+1${digitsOnly}`;
    }
    
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return `+${digitsOnly}`;
    }
    
    if (phone.startsWith('+')) {
        return phone;
    }
    
    return `+1${digitsOnly}`;
}

// UPDATED: Function to make VAPI call with database integration
// Supports both index-based calls (CSV) and database ID-based calls (manual)
async function makeVAPICall(contact, index, campaignId = CALL_SYSTEM.currentCampaignId, assistantId, phoneNumberId, dbCallId = null) {
    const effectiveAssistantId = assistantId || CALL_SYSTEM.currentAssistantId || VAPI_CONFIG.assistantId;
    const effectivePhoneNumberId = phoneNumberId || CALL_SYSTEM.currentPhoneNumberId || VAPI_CONFIG.phoneNumberId;
    const effectiveCampaignId = campaignId || CALL_SYSTEM.currentCampaignId;
    const formattedPhoneNumber = formatPhoneNumber(contact.phone);

    try {
        CALL_SYSTEM.activeCalls++;
        
        const callData = {
            assistantId: effectiveAssistantId,
            phoneNumberId: effectivePhoneNumberId,
            customer: {
                number: formattedPhoneNumber
            },
            assistantOverrides: {
                variableValues: {
                    name: contact.name,
                    "customer.number": formattedPhoneNumber,
                    address: contact.address
                }
            }
        };

        const callLabel = dbCallId ? `[DB ID: ${dbCallId}]` : `[${index !== null ? index + 1 : 'Manual'}]`;
        console.log(`${callLabel} 📞 Making VAPI call for: ${contact.name} ${formattedPhoneNumber}`);

        const response = await axios.post(`${VAPI_CONFIG.baseUrl}/call`, callData, {
            headers: {
                'Authorization': `Bearer ${VAPI_CONFIG.privateKey}`,
                'Content-Type': 'application/json'
            }
        });

        // Update database with call ID - supports both index-based and ID-based updates
        console.log(`🔧 Updating database: phone=${formattedPhoneNumber}, campaign=${effectiveCampaignId}, index=${index}, dbCallId=${dbCallId}, callId=${response.data.id}`);
        
        try {
            let updateResult;
            if (dbCallId) {
                // Update by database ID (for manual leads)
                updateResult = await pool.query(`
                    UPDATE calls SET 
                        call_id = $1,
                        status = $2,
                        message = $3,
                        timestamp = $4,
                        assistant_id = COALESCE(assistant_id, $5),
                        phone_number_id = COALESCE(phone_number_id, $6)
                    WHERE id = $7
                `, [
                    response.data.id,
                    'calling',
                    `Call initiated for ${contact.name}`,
                    new Date().toISOString(),
                    effectiveAssistantId,
                    effectivePhoneNumberId,
                    dbCallId
                ]);
            } else {
                // Update by index_position (for CSV calls)
                updateResult = await pool.query(`
                    UPDATE calls SET 
                        call_id = $1,
                        status = $2,
                        message = $3,
                        timestamp = $4,
                        assistant_id = COALESCE(assistant_id, $5),
                        phone_number_id = COALESCE(phone_number_id, $6)
                    WHERE contact_phone = $7 AND campaign_id = $8 AND index_position = $9
                `, [
                    response.data.id,
                    'calling',
                    `Call initiated for ${contact.name}`,
                    new Date().toISOString(),
                    effectiveAssistantId,
                    effectivePhoneNumberId,
                    formattedPhoneNumber,
                    effectiveCampaignId,
                    index
                ]);
            }
            
            console.log(`💾 Updated ${updateResult.rowCount} database records with call_id for ${contact.name}`);
            if (updateResult.rowCount === 0) {
                console.log(`⚠️ No database records updated for ${contact.name}`);
                if (dbCallId) {
                    console.log(`   Expected: dbCallId=${dbCallId}`);
                } else {
                    console.log(`   Expected: phone=${formattedPhoneNumber}, campaign=${effectiveCampaignId}, index=${index}`);
                }
            }
        } catch (err) {
            console.error('❌ Error updating call with call_id:', err);
            throw err;
        }

        console.log(`${callLabel} ✅ VAPI call successful for ${contact.name}`);
        
        return {
            success: true,
            contact: contact,
            callId: response.data.id,
            message: `Call initiated for ${contact.name}`,
            timestamp: new Date().toISOString(),
            index: index,
            dbCallId: dbCallId,
            status: 'calling'
        };

    } catch (error) {
        // Update database with error - supports both update methods
        const phoneNumber = formattedPhoneNumber;
        try {
            let updateResult;
            if (dbCallId) {
                updateResult = await pool.query(`
                    UPDATE calls SET 
                        status = $1,
                        message = $2,
                        assistant_id = COALESCE(assistant_id, $3),
                        phone_number_id = COALESCE(phone_number_id, $4)
                    WHERE id = $5
                `, [
                    'failed', `Failed to call ${contact.name}: ${error.message}`,
                    effectiveAssistantId, effectivePhoneNumberId,
                    dbCallId
                ]);
            } else {
                updateResult = await pool.query(`
                    UPDATE calls SET 
                        status = $1,
                        message = $2,
                        assistant_id = COALESCE(assistant_id, $3),
                        phone_number_id = COALESCE(phone_number_id, $4)
                    WHERE contact_phone = $5 AND campaign_id = $6 AND index_position = $7
                `, [
                    'failed', `Failed to call ${contact.name}: ${error.message}`,
                    effectiveAssistantId, effectivePhoneNumberId,
                    phoneNumber, effectiveCampaignId, index
                ]);
            }
            console.log(`💾 Updated ${updateResult.rowCount} failed call records for ${contact.name}`);
        } catch (updateErr) {
            console.error('❌ Error updating failed call in database:', updateErr);
        }

        const callLabel = dbCallId ? `[DB ID: ${dbCallId}]` : `[${index !== null ? index + 1 : 'Manual'}]`;
        console.error(`${callLabel} ❌ Error making VAPI call for ${contact.name}:`, error.message);
        
        return {
            success: false,
            contact: contact,
            error: error.message,
            message: `Failed to call ${contact.name}: ${error.message}`,
            timestamp: new Date().toISOString(),
            index: index,
            dbCallId: dbCallId,
            status: 'failed'
        };
    } finally {
        CALL_SYSTEM.activeCalls--;
        processNextCall();
    }
}

// NEW: Function to make a retry call (for voicemail retries)
async function makeRetryCall(contact, originalCallId, campaignId, retryCount, assistantId, phoneNumberId) {
    const effectiveAssistantId = assistantId || CALL_SYSTEM.currentAssistantId || VAPI_CONFIG.assistantId;
    const effectivePhoneNumberId = phoneNumberId || CALL_SYSTEM.currentPhoneNumberId || VAPI_CONFIG.phoneNumberId;
    const effectiveCampaignId = campaignId || CALL_SYSTEM.currentCampaignId;
    const formattedPhoneNumber = formatPhoneNumber(contact.phone);

    try {
        CALL_SYSTEM.activeCalls++;
        
        const callData = {
            assistantId: effectiveAssistantId,
            phoneNumberId: effectivePhoneNumberId,
            customer: {
                number: formattedPhoneNumber
            },
            assistantOverrides: {
                variableValues: {
                    name: contact.name,
                    "customer.number": formattedPhoneNumber,
                    address: contact.address
                }
            }
        };

        console.log(`🔄 Making RETRY call for: ${contact.name} ${formattedPhoneNumber} (Original: ${originalCallId})`);

        const response = await axios.post(`${VAPI_CONFIG.baseUrl}/call`, callData, {
            headers: {
                'Authorization': `Bearer ${VAPI_CONFIG.privateKey}`,
                'Content-Type': 'application/json'
            }
        });

        // Get current time in Eastern timezone for retry call
        const now = new Date();
        // Format time in Eastern timezone directly
        const easternTimeString = now.toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Create a new database record for the retry call
        const retryCallData = {
            contact: contact,
            callId: response.data.id,
            status: 'calling',
            scheduledTime: now.toISOString(),
            scheduledTimeLocal: easternTimeString,
            message: `Retry call #${retryCount + 1} initiated for ${contact.name} (voicemail retry)`,
            timestamp: new Date().toISOString(),
            campaignId: campaignId,
            index: null, // Retries don't have an index position
            isRetry: true,
            originalCallId: originalCallId,
            retryCount: retryCount + 1,
            assistantId: effectiveAssistantId,
            phoneNumberId: effectivePhoneNumberId
        };

        DB_HELPERS.saveCall(retryCallData, (err, dbId) => {
            if (err) {
                console.error('❌ Error saving retry call to database:', err);
            } else {
                console.log(`💾 Saved retry call to database with ID ${dbId}`);
            }
        });

        // Update the retry count on the original call
        DB_HELPERS.updateRetryCount(originalCallId, (err) => {
            if (err) {
                console.error('❌ Error updating retry count:', err);
            } else {
                console.log(`📊 Updated retry count for original call ${originalCallId}`);
            }
        });

        console.log(`🔄 ✅ Retry call successful for ${contact.name}`);
        
        return {
            success: true,
            contact: contact,
            callId: response.data.id,
            message: `Retry call #${retryCount + 1} initiated for ${contact.name}`,
            timestamp: new Date().toISOString(),
            status: 'calling',
            isRetry: true,
            originalCallId: originalCallId
        };

    } catch (error) {
        console.error(`🔄 ❌ Error making retry call for ${contact.name}:`, error.message);
        
        // Save failed retry call to database
        const failedRetryCallData = {
            contact: contact,
            callId: null,
            status: 'failed',
            message: `Retry call failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            campaignId: campaignId,
            index: null,
            isRetry: true,
            originalCallId: originalCallId,
            retryCount: retryCount + 1,
            assistantId: effectiveAssistantId,
            phoneNumberId: effectivePhoneNumberId
        };

        DB_HELPERS.saveCall(failedRetryCallData, (err) => {
            if (err) {
                console.error('❌ Error saving failed retry call to database:', err);
            }
        });
        
        return {
            success: false,
            contact: contact,
            error: error.message,
            message: `Retry call failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            status: 'failed',
            isRetry: true,
            originalCallId: originalCallId
        };
    } finally {
        CALL_SYSTEM.activeCalls--;
        processNextCall();
    }
}

// NEW: Function to schedule voicemail retry
function scheduleVoicemailRetry(callId) {
    console.log(`🔄 Scheduling voicemail retry for call: ${callId}`);
    
    // Get the call information from database
    DB_HELPERS.getCallByCallId(callId, (err, call) => {
        if (err || !call) {
            console.error('❌ Error getting call for retry:', err);
            return;
        }
        
        // Check if this call is already a retry (don't retry retries)
        if (call.isRetry) {
            console.log(`⏭️ Skipping retry - call ${callId} is already a retry call`);
            return;
        }
        
        // Check if we've already retried this call (retry count should be 0 for original call)
        if (call.retryCount > 0) {
            console.log(`⏭️ Skipping retry - call ${callId} has already been retried ${call.retryCount} time(s)`);
            return;
        }
        
        // Check if the outcome is actually voicemail
        const isVoicemail = (
            (call.callOutcome && call.callOutcome.toLowerCase() === 'voicemail') ||
            (call.endedReason && call.endedReason.toLowerCase() === 'voicemail') ||
            (call.structuredData && call.structuredData.CallOutcome && call.structuredData.CallOutcome.toLowerCase() === 'voicemail')
        );
        
        if (!isVoicemail) {
            console.log(`⏭️ Skipping retry - call ${callId} outcome is not voicemail: ${call.callOutcome || call.endedReason}`);
            return;
        }
        
        console.log(`✅ Scheduling retry for ${call.contact.name} (${call.contact.phone}) in 1 minute`);
        
        // Schedule the retry in 1 minute (60000 milliseconds)
        const retryTimer = setTimeout(() => {
            console.log(`🔄 Executing retry call for ${call.contact.name} (Original call: ${callId})`);
            makeRetryCall(
                call.contact,
                callId,
                call.campaignId,
                call.retryCount,
                call.assistantId,
                call.phoneNumberId
            );
            
            // Remove timer from tracking array
            const index = CALL_SYSTEM.retryTimers.indexOf(retryTimer);
            if (index > -1) {
                CALL_SYSTEM.retryTimers.splice(index, 1);
            }
        }, 60000); // 1 minute = 60000 milliseconds
        
        // Track the retry timer
        CALL_SYSTEM.retryTimers.push(retryTimer);
        
        console.log(`⏰ Retry scheduled for ${call.contact.name} - will execute in 60 seconds`);
    });
}

// Function to process next call in queue
function processNextCall() {
    if (CALL_SYSTEM.activeCalls < CALL_SYSTEM.maxConcurrent && CALL_SYSTEM.pendingCalls.length > 0) {
        const nextCall = CALL_SYSTEM.pendingCalls.shift();
        makeVAPICall(
            nextCall.contact,
            nextCall.index,
            nextCall.campaignId,
            nextCall.assistantId,
            nextCall.phoneNumberId
        );
    }
}

// Function to queue call with concurrency control
function queueCall(
    contact,
    index,
    campaignId = CALL_SYSTEM.currentCampaignId,
    assistantId = CALL_SYSTEM.currentAssistantId,
    phoneNumberId = CALL_SYSTEM.currentPhoneNumberId
) {
    if (CALL_SYSTEM.activeCalls < CALL_SYSTEM.maxConcurrent) {
        makeVAPICall(contact, index, campaignId, assistantId, phoneNumberId);
    } else {
        CALL_SYSTEM.pendingCalls.push({ contact, index, campaignId, assistantId, phoneNumberId });
        console.log(`[${index + 1}] ⏳ Queued call for ${contact.name} (Queue position: ${CALL_SYSTEM.pendingCalls.length})`);
    }
}

// UPDATED: Function to schedule calls with database persistence
function scheduleCallsAcrossTimeWindow(contacts, startTime, endTime) {
    // Clear any existing timers
    CALL_SYSTEM.timers.forEach(timer => clearTimeout(timer));
    CALL_SYSTEM.timers = [];
    
    // Get current time in Eastern timezone
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    console.log(`🐛 DEBUG: Server UTC time: ${now.toISOString()}`);
    console.log(`🐛 DEBUG: Eastern time: ${easternTime.toLocaleString()}`);
    
    // Create start and end times for TODAY in Eastern timezone
    const [startHour, startMin] = startTime.split(':');
    const [endHour, endMin] = endTime.split(':');
    
    // Use Eastern time to create today's schedule
    const startDateTime = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate(), 
                                   parseInt(startHour), parseInt(startMin), 0);
    const endDateTime = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate(), 
                                 parseInt(endHour), parseInt(endMin), 0);
    
    console.log(`🐛 DEBUG: Start DateTime: ${startDateTime.toLocaleString()} (${startDateTime.toISOString()})`);
    console.log(`🐛 DEBUG: End DateTime: ${endDateTime.toLocaleString()} (${endDateTime.toISOString()})`);
    
    // Calculate delays based on actual Eastern time
    const actualStartTime = startDateTime < easternTime ? easternTime : startDateTime;
    const windowDurationMs = endDateTime - actualStartTime;
    
    console.log(`🐛 DEBUG: Window duration: ${windowDurationMs}ms (${windowDurationMs/1000/60} minutes)`);
    console.log(`🐛 DEBUG: Time until start: ${(actualStartTime - easternTime)/1000}s`);
    
    if (windowDurationMs <= 0) {
        console.log('⚠️ Time window is in the past or invalid, making calls immediately');
        contacts.forEach((contact, index) => {
            queueCall(
                contact,
                index,
                CALL_SYSTEM.currentCampaignId,
                CALL_SYSTEM.currentAssistantId,
                CALL_SYSTEM.currentPhoneNumberId
            );
        });
        return;
    }
    
    // Calculate interval between calls
    const totalCalls = contacts.length;
    const intervalMs = windowDurationMs / Math.max(1, totalCalls - 1);
    
    console.log(`⏰ Scheduling ${totalCalls} calls across time window (Eastern Time):`);
    console.log(`   Start: ${actualStartTime.toLocaleString()}`);
    console.log(`   End: ${endDateTime.toLocaleString()}`);
    console.log(`   Interval: ${Math.round(intervalMs / 1000 / 60)} minutes between calls`);
    
    // Schedule each call and save to database
    const activeCampaignId = CALL_SYSTEM.currentCampaignId;
    const activeAssistantId = CALL_SYSTEM.currentAssistantId;
    const activePhoneNumberId = CALL_SYSTEM.currentPhoneNumberId;
    contacts.forEach((contact, index) => {
        const callTime = new Date(actualStartTime.getTime() + (intervalMs * index));
        const delayMs = callTime - easternTime;
        
        console.log(`🐛 DEBUG [${index + 1}]: Call time: ${callTime.toLocaleString()}, Delay: ${Math.round(delayMs/1000)}s`);
        
        // NEW: Save to database immediately
        const callData = {
            contact: contact,
            index: index,
            status: 'scheduled',
            scheduledTime: callTime.toISOString(),
            scheduledTimeLocal: callTime.toLocaleTimeString(),
            message: `Scheduled for ${callTime.toLocaleTimeString()}`,
            timestamp: new Date().toISOString(),
            campaignId: activeCampaignId,
            assistantId: activeAssistantId,
            phoneNumberId: activePhoneNumberId
        };
        
        DB_HELPERS.saveCall(callData, (err, dbId) => {
            if (err) {
                console.error(`❌ Error saving call to database:`, err);
            } else {
                console.log(`💾 Saved call ${index + 1} to database with ID ${dbId}`);
            }
        });
        
        if (delayMs <= 0) {
            console.log(`[${index + 1}] 🚀 Calling ${contact.name} immediately`);
            queueCall(contact, index, activeCampaignId, activeAssistantId, activePhoneNumberId);
        } else {
            console.log(`[${index + 1}] ⏰ Scheduled ${contact.name} for ${callTime.toLocaleTimeString()} (in ${Math.round(delayMs/1000)}s)`);
            
            const timer = setTimeout(() => {
                console.log(`[${index + 1}] 🔔 Timer fired! Time to call ${contact.name}`);
                queueCall(contact, index, activeCampaignId, activeAssistantId, activePhoneNumberId);
            }, delayMs);
            
            CALL_SYSTEM.timers.push(timer);
        }
    });
    
    console.log(`🐛 DEBUG: Set ${CALL_SYSTEM.timers.length} timers`);
}

// NEW: Rehydrate scheduled calls after restart
async function rehydrateScheduledCalls() {
    try {
        const result = await pool.query(`
            SELECT * FROM calls
            WHERE status = 'scheduled'
            ORDER BY scheduled_time
        `);
        
        if (result.rows.length === 0) {
            console.log('♻️ No scheduled calls to rehydrate');
            return;
        }
        
        console.log(`♻️ Rehydrating ${result.rows.length} scheduled call(s)`);
        
        const now = new Date();
        const campaignCache = new Map();
        // Remember most recent campaign with scheduled calls
        const latestRow = result.rows[result.rows.length - 1];
        if (latestRow && latestRow.campaign_id) {
            CALL_SYSTEM.currentCampaignId = latestRow.campaign_id;
            const latestCampaignMeta = await DB_HELPERS.getCampaignById(latestRow.campaign_id);
            if (latestCampaignMeta) {
                CALL_SYSTEM.currentAssistantId = latestCampaignMeta.assistant_id || null;
                CALL_SYSTEM.currentPhoneNumberId = latestCampaignMeta.phone_number_id || null;
            }
        }
        
        for (const row of result.rows) {
            const campaignId = row.campaign_id;
            const contact = {
                name: row.contact_name,
                phone: row.contact_phone,
                address: row.contact_address
            };

            let assistantId = row.assistant_id || null;
            let phoneNumberId = row.phone_number_id || null;

            if ((!assistantId || !phoneNumberId) && campaignId) {
                if (!campaignCache.has(campaignId)) {
                    const meta = await DB_HELPERS.getCampaignById(campaignId);
                    campaignCache.set(campaignId, meta);
                }
                const cached = campaignCache.get(campaignId);
                if (cached) {
                    assistantId = assistantId || cached.assistant_id;
                    phoneNumberId = phoneNumberId || cached.phone_number_id;
                }
            }
            
            let scheduledTime = null;
            if (row.scheduled_time) {
                scheduledTime = new Date(row.scheduled_time);
            }
            const delayMs = scheduledTime ? scheduledTime.getTime() - now.getTime() : 0;
            const readableTime = scheduledTime ? scheduledTime.toLocaleString() : 'immediate';
            const callIndex = row.index_position != null ? row.index_position : 0;
            
            if (delayMs <= 0) {
                console.log(`♻️ [${callIndex + 1}] Scheduling immediate call for ${contact.name} (campaign ${campaignId})`);
                queueCall(contact, callIndex, campaignId, assistantId, phoneNumberId);
            } else {
                console.log(`♻️ [${callIndex + 1}] Restoring timer for ${contact.name} at ${readableTime} (in ${Math.round(delayMs/1000)}s)`);
                const timer = setTimeout(() => {
                    console.log(`♻️ Timer fired for ${contact.name} (campaign ${campaignId})`);
                    queueCall(contact, callIndex, campaignId, assistantId, phoneNumberId);
                }, delayMs);
                CALL_SYSTEM.timers.push(timer);
            }
        }
    } catch (err) {
        console.error('❌ Error rehydrating scheduled calls:', err);
    }
}

function isAuthenticated(req) {
    return Boolean(req.session && req.session.isAuthenticated);
}

function sanitizeRedirect(target) {
    if (!target || typeof target !== 'string') {
        return '/';
    }
    if (!target.startsWith('/')) {
        return '/';
    }
    return target;
}

// Authentication routes
app.get('/login', (req, res) => {
    if (isAuthenticated(req)) {
        const redirectTarget = sanitizeRedirect(req.query.redirect);
        return res.redirect(redirectTarget);
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password, redirect } = req.body || {};

    const suppliedUsername = normalizeSecret(username);
    const suppliedPassword = normalizeSecret(password);

    if (EXPECTED_USERNAME && EXPECTED_PASSWORD &&
        suppliedUsername === EXPECTED_USERNAME &&
        suppliedPassword === EXPECTED_PASSWORD) {
        req.session.isAuthenticated = true;
        req.session.username = LOGIN_USERNAME;
        req.session.loginAt = Date.now();

        const redirectTarget = sanitizeRedirect(redirect);
        return res.redirect(redirectTarget);
    }

    const redirectSuffix = redirect ? `&redirect=${encodeURIComponent(sanitizeRedirect(redirect))}` : '';
    res.redirect(`/login?error=1${redirectSuffix}`);
});

app.post('/logout', (req, res) => {
    req.session = null;
    res.redirect('/login');
});

const AUTH_WHITELIST_PATHS = new Set(['/login', '/logout', '/health', '/favicon.ico']);
const AUTH_WHITELIST_PREFIXES = ['/webhook'];

app.use((req, res, next) => {
    if (AUTH_WHITELIST_PATHS.has(req.path) || AUTH_WHITELIST_PREFIXES.some(prefix => req.path.startsWith(prefix))) {
        return next();
    }

    if (isAuthenticated(req)) {
        return next();
    }

    if (req.method === 'GET') {
        const redirectParam = encodeURIComponent(req.originalUrl || '/');
        return res.redirect(`/login?redirect=${redirectParam}`);
    }

    return res.status(401).json({ error: 'Not authenticated' });
});

// Serve static files from public directory (protected by auth middleware)
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// NEW: Get all campaigns endpoint
app.get('/api/resources', async (req, res) => {
    try {
        const [assistants, phoneNumbers] = await Promise.all([
            DB_HELPERS.getAssistants(),
            DB_HELPERS.getPhoneNumbers()
        ]);

        res.json({
            assistants: assistants.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                isActive: item.is_active
            })),
            phoneNumbers: phoneNumbers.map(item => ({
                id: item.id,
                displayName: item.display_name,
                phoneNumber: item.phone_number,
                isActive: item.is_active
            }))
        });
    } catch (error) {
        console.error('❌ Error fetching assistants/phone numbers:', error);
        res.status(500).json({ error: 'Error loading assistants and phone numbers' });
    }
});

// NEW: Get all campaigns endpoint
app.get('/api/campaigns', (req, res) => {
    DB_HELPERS.getAllCampaigns((err, campaigns) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching campaigns' });
        }
        res.json({ campaigns: campaigns });
    });
});

// NEW: Delete campaign endpoint
app.delete('/api/campaigns/:campaignId', async (req, res) => {
    const { campaignId } = req.params;
    
    if (!campaignId) {
        return res.status(400).json({ error: 'Campaign ID is required' });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Check if campaign exists and is not already deleted
        const campaignCheck = await client.query(`
            SELECT id, deleted_at 
            FROM campaigns 
            WHERE id = $1
        `, [campaignId]);

        if (campaignCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ error: 'Campaign not found' });
        }

        if (campaignCheck.rows[0].deleted_at) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(410).json({ error: 'Campaign already deleted' });
        }

        // Get call count for response
        const callCountResult = await client.query(`
            SELECT COUNT(*) as count 
            FROM calls 
            WHERE campaign_id = $1
        `, [campaignId]);
        const callCount = parseInt(callCountResult.rows[0].count);

        // Soft delete: Set deleted_at timestamp (allows for future recovery/archiving)
        await client.query(`
            UPDATE campaigns 
            SET deleted_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [campaignId]);

        // Optionally, you can also delete associated calls
        // For now, we'll keep calls but they won't show up in campaign queries
        // Uncomment below for hard delete of calls:
        // await client.query(`
        //     DELETE FROM calls 
        //     WHERE campaign_id = $1
        // `, [campaignId]);

        await client.query('COMMIT');
        client.release();

        res.json({ 
            success: true, 
            message: 'Campaign deleted successfully',
            campaignId: campaignId,
            deletedCallCount: callCount
        });
    } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        console.error('❌ Error deleting campaign:', err);
        res.status(500).json({ 
            error: 'Error deleting campaign',
            details: err.message 
        });
    }
});

// UPDATED: Get current call status from database (now accepts optional campaignId parameter)
app.get('/status', (req, res) => {
    const requestedCampaignId = req.query.campaignId;
    
    // If a specific campaign ID is requested, use it
    if (requestedCampaignId) {
        DB_HELPERS.getCallsForCampaign(requestedCampaignId, async (err, calls) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching call data' });
            }
            
            const totalCalls = calls.length;
            const completedCalls = calls.filter(call => call.status === 'completed').length;
            const successfulCalls = calls.filter(call => call.successEvaluation === 'Pass').length;
            const failedCalls = calls.filter(call => call.successEvaluation === 'Fail').length;
            // For past campaigns, active/pending calls are not relevant (they're historical)
            const activeCalls = requestedCampaignId === CALL_SYSTEM.currentCampaignId ? CALL_SYSTEM.activeCalls : 0;
            const pendingCalls = requestedCampaignId === CALL_SYSTEM.currentCampaignId ? CALL_SYSTEM.pendingCalls.length : 0;
            const scheduledCalls = calls.filter(call => call.status === 'scheduled').length;

            let campaignMeta = null;
            try {
                campaignMeta = await DB_HELPERS.getCampaignById(requestedCampaignId);
            } catch (metaErr) {
                console.error('❌ Error loading campaign metadata for status:', metaErr);
            }
            
            res.json({
                calls: calls,
                summary: {
                    total: totalCalls,
                    completed: completedCalls,
                    successful: successfulCalls,
                    failed: failedCalls,
                    active: activeCalls,
                    pending: pendingCalls,
                    scheduled: scheduledCalls
                },
                timers: requestedCampaignId === CALL_SYSTEM.currentCampaignId ? CALL_SYSTEM.timers.length : 0,
                campaignId: requestedCampaignId,
                isCurrentCampaign: requestedCampaignId === CALL_SYSTEM.currentCampaignId,
                campaign: campaignMeta ? {
                    id: campaignMeta.id,
                    assistantId: campaignMeta.assistant_id,
                    assistantName: campaignMeta.assistant_name,
                    phoneNumberId: campaignMeta.phone_number_id,
                    phoneNumberName: campaignMeta.phone_number_name
                } : null
            });
        });
        return;
    }
    
    // Original behavior: If no current campaign, try to load the most recent one
    if (!CALL_SYSTEM.currentCampaignId) {
        pool.query(`
            SELECT campaign_id FROM calls 
            ORDER BY timestamp DESC 
            LIMIT 1
        `).then(result => {
            if (result.rows.length > 0) {
                CALL_SYSTEM.currentCampaignId = result.rows[0].campaign_id;
                console.log('🔄 Auto-loaded most recent campaign:', CALL_SYSTEM.currentCampaignId);
                DB_HELPERS.getCampaignById(CALL_SYSTEM.currentCampaignId)
                    .then(meta => {
                        if (meta) {
                            CALL_SYSTEM.currentAssistantId = meta.assistant_id || null;
                            CALL_SYSTEM.currentPhoneNumberId = meta.phone_number_id || null;
                        }
                    })
                    .catch(err => {
                        console.error('❌ Error loading campaign metadata:', err);
                    });
            }
            getCalls();
        }).catch(err => {
            console.error('❌ Error loading most recent campaign:', err);
            getCalls();
        });
    } else {
        getCalls();
    }
    
    function getCalls() {
        DB_HELPERS.getCurrentCalls(async (err, calls) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching call data' });
            }
            
            const totalCalls = calls.length;
            const completedCalls = calls.filter(call => call.status === 'completed').length;
            const successfulCalls = calls.filter(call => call.successEvaluation === 'Pass').length;
            const failedCalls = calls.filter(call => call.successEvaluation === 'Fail').length;
            const activeCalls = CALL_SYSTEM.activeCalls;
            const pendingCalls = CALL_SYSTEM.pendingCalls.length;
            const scheduledCalls = calls.filter(call => call.status === 'scheduled').length;

            let campaignMeta = null;
            if (CALL_SYSTEM.currentCampaignId) {
                try {
                    campaignMeta = await DB_HELPERS.getCampaignById(CALL_SYSTEM.currentCampaignId);
                } catch (metaErr) {
                    console.error('❌ Error loading campaign metadata for current campaign:', metaErr);
                }
            }
            
            res.json({
                calls: calls,
                summary: {
                    total: totalCalls,
                    completed: completedCalls,
                    successful: successfulCalls,
                    failed: failedCalls,
                    active: activeCalls,
                    pending: pendingCalls,
                    scheduled: scheduledCalls
                },
                timers: CALL_SYSTEM.timers.length,
                campaignId: CALL_SYSTEM.currentCampaignId,
                isCurrentCampaign: true,
                campaign: campaignMeta ? {
                    id: campaignMeta.id,
                    assistantId: campaignMeta.assistant_id,
                    assistantName: campaignMeta.assistant_name,
                    phoneNumberId: campaignMeta.phone_number_id,
                    phoneNumberName: campaignMeta.phone_number_name
                } : null
            });
        });
    }
});

// NEW: Campaign analytics endpoint
app.get('/analytics', async (req, res) => {
    try {
        const campaignId = req.query.campaignId || CALL_SYSTEM.currentCampaignId;
        if (!campaignId) {
            return res.status(400).json({ error: 'No campaign selected' });
        }

        const totalsResult = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN call_id IS NOT NULL THEN 1 ELSE 0 END),0)::int AS total,
                COALESCE(SUM(CASE WHEN call_id IS NOT NULL AND COALESCE(structured_data->>'Answered','') = 'yes' THEN 1 ELSE 0 END),0)::int AS answered,
                COALESCE(SUM(CASE WHEN call_id IS NOT NULL AND (COALESCE(structured_data->>'Answered','') = 'no' OR ended_reason = 'voicemail') THEN 1 ELSE 0 END),0)::int AS voicemail,
                COALESCE(SUM(CASE WHEN call_id IS NOT NULL AND is_retry THEN 1 ELSE 0 END),0)::int AS retries
            FROM calls
            WHERE campaign_id = $1
        `, [campaignId]);

        const totalsRow = totalsResult.rows[0] || { total: 0, answered: 0, voicemail: 0, retries: 0 };

        const outcomesResult = await pool.query(`
            SELECT 
                COALESCE(NULLIF(TRIM(LOWER(REGEXP_REPLACE(
                    COALESCE(structured_data->>'CallOutcome', call_outcome, ended_reason, 'unknown'),
                    '\\s+','_','g'
                ))), ''), 'unknown') AS outcome,
                COUNT(*)::int AS count
            FROM calls
            WHERE campaign_id = $1
              AND call_id IS NOT NULL
              AND COALESCE(structured_data->>'Answered','') = 'yes'
            GROUP BY outcome
            ORDER BY count DESC
        `, [campaignId]);

        res.json({
            totals: {
                total: totalsRow.total,
                answered: totalsRow.answered,
                voicemail: totalsRow.voicemail,
                retries: totalsRow.retries
            },
            outcomes: outcomesResult.rows
        });
    } catch (error) {
        console.error('❌ Error fetching analytics:', error);
        res.status(500).json({ error: 'Error fetching analytics data' });
    }
});

// Handle CSV file upload and processing with time window scheduling
app.post('/upload', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;
    const assistantId = req.body.assistantId;
    const phoneNumberId = req.body.phoneNumberId;
    
    if (!startTime || !endTime) {
        return res.status(400).json({ error: 'Start time and end time are required' });
    }

    if (!assistantId || !phoneNumberId) {
        return res.status(400).json({ error: 'Assistant and phone number selections are required' });
    }

    let selectedAssistant = null;
    let selectedPhoneNumber = null;

    try {
        const [assistant, phoneNumber] = await Promise.all([
            DB_HELPERS.getAssistantById(assistantId),
            DB_HELPERS.getPhoneNumberById(phoneNumberId)
        ]);

        if (!assistant || assistant.is_active === false) {
            return res.status(400).json({ error: 'Selected assistant is not available. Please refresh and try again.' });
        }

        if (!phoneNumber || phoneNumber.is_active === false) {
            return res.status(400).json({ error: 'Selected phone number is not available. Please refresh and try again.' });
        }

        selectedAssistant = assistant;
        selectedPhoneNumber = phoneNumber;
    } catch (validationError) {
        console.error('❌ Error validating assistant/phone selection:', validationError);
        return res.status(500).json({ error: 'Error validating assistant and phone number selection' });
    }
    
    console.log('📁 File uploaded:', req.file.filename);
    console.log('⏰ Calling window:', startTime, 'to', endTime);
    
    // Calculate time window
    const start = new Date(`2024-01-01 ${startTime}`);
    const end = new Date(`2024-01-01 ${endTime}`);
    const windowHours = (end - start) / (1000 * 60 * 60);
    
    if (windowHours <= 0) {
        return res.status(400).json({ error: 'Invalid time window' });
    }
    
    // NEW: Create unique campaign ID
    CALL_SYSTEM.currentCampaignId = `campaign_${Date.now()}`;
    CALL_SYSTEM.currentAssistantId = assistantId;
    CALL_SYSTEM.currentPhoneNumberId = phoneNumberId;
    console.log('🎯 Created new campaign:', CALL_SYSTEM.currentCampaignId);
    
    // Cancel existing timers
    CALL_SYSTEM.timers.forEach(timer => clearTimeout(timer));
    CALL_SYSTEM.timers = [];
    CALL_SYSTEM.pendingCalls = [];
    CALL_SYSTEM.activeCalls = 0;
    
    // Persist campaign metadata
    try {
        await DB_HELPERS.createCampaign(CALL_SYSTEM.currentCampaignId, assistantId, phoneNumberId);
    } catch (campaignError) {
        console.error('❌ Error creating campaign metadata:', campaignError);
        return res.status(500).json({ error: 'Error creating campaign metadata' });
    }

    // Process the CSV file
    const contacts = [];
    const filePath = req.file.path;
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            contacts.push({
                name: row.Name || row.name,
                phone: row.Phone || row.phone,
                address: row.Address || row.address
            });
        })
        .on('end', async () => {
            console.log(`📊 CSV processing complete. Found ${contacts.length} contacts`);
            console.log(`⏰ Time window: ${windowHours} hours`);
            
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            
            // Schedule calls across the time window (now saves to database)
            scheduleCallsAcrossTimeWindow(contacts, startTime, endTime);
            
            // Send response immediately
            res.json({ 
                message: `Calls scheduled successfully across time window!`,
                totalContacts: contacts.length,
                windowHours: windowHours,
                startTime: startTime,
                endTime: endTime,
                maxConcurrent: CALL_SYSTEM.maxConcurrent,
                intervalMinutes: Math.round((windowHours * 60) / Math.max(1, contacts.length - 1)),
                campaignId: CALL_SYSTEM.currentCampaignId,
                assistant: selectedAssistant ? {
                    id: selectedAssistant.id,
                    name: selectedAssistant.name
                } : null,
                phoneNumber: selectedPhoneNumber ? {
                    id: selectedPhoneNumber.id,
                    displayName: selectedPhoneNumber.display_name,
                    phoneNumber: selectedPhoneNumber.phone_number
                } : null
            });
        })
        .on('error', (error) => {
            console.error('❌ Error processing CSV:', error);
            res.status(500).json({ error: 'Error processing CSV file' });
        });
});

// Cancel all scheduled calls
app.post('/cancel-calls', (req, res) => {
    try {
        // Clear all timers
        const cancelledTimers = CALL_SYSTEM.timers.length;
        CALL_SYSTEM.timers.forEach(timer => clearTimeout(timer));
        CALL_SYSTEM.timers = [];
        
        // Clear pending calls queue
        const cancelledPending = CALL_SYSTEM.pendingCalls.length;
        CALL_SYSTEM.pendingCalls = [];
        
        // NEW: Update database to mark scheduled calls as cancelled
        if (CALL_SYSTEM.currentCampaignId) {
            pool.query(`
                UPDATE calls SET 
                    status = 'cancelled', 
                    message = 'Call cancelled by user'
                WHERE campaign_id = $1 AND status = 'scheduled'
            `, [CALL_SYSTEM.currentCampaignId]).then(result => {
                console.log(`💾 Updated ${result.rowCount} cancelled calls in database`);
            }).catch(err => {
                console.error('❌ Error updating cancelled calls in database:', err);
            });
        }
        
        console.log(`🛑 Cancelled ${cancelledTimers} scheduled calls and ${cancelledPending} pending calls`);
        
        res.json({
            success: true,
            message: `Cancelled ${cancelledTimers + cancelledPending} upcoming calls. Active calls will complete.`,
            cancelledTimers: cancelledTimers,
            cancelledPending: cancelledPending,
            activeCalls: CALL_SYSTEM.activeCalls
        });
        
    } catch (error) {
        console.error('Error cancelling calls:', error);
        res.status(500).json({ error: 'Error cancelling calls' });
    }
});

// NEW: Add new lead to campaign endpoint
app.post('/api/add-lead', express.json(), async (req, res) => {
    try {
        const { name, phone, address, campaignId } = req.body;
        
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }
        
        const effectiveCampaignId = campaignId || CALL_SYSTEM.currentCampaignId;
        if (!effectiveCampaignId) {
            return res.status(400).json({ error: 'No active campaign. Please create a campaign first by uploading a CSV.' });
        }
        
        // Get campaign metadata to get assistant and phone number IDs
        const campaignMeta = await DB_HELPERS.getCampaignById(effectiveCampaignId);
        if (!campaignMeta) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        const formattedPhone = formatPhoneNumber(phone);
        
        // Create call record with index_position = NULL (manual lead)
        const callData = {
            contact: {
                name: name.trim(),
                phone: formattedPhone,
                address: address || ''
            },
            status: 'scheduled',
            message: 'Manually added lead',
            timestamp: new Date().toISOString(),
            campaignId: effectiveCampaignId,
            index: null, // Manual leads don't have index
            assistantId: campaignMeta.assistant_id,
            phoneNumberId: campaignMeta.phone_number_id
        };
        
        DB_HELPERS.saveCall(callData, async (err, dbId) => {
            if (err) {
                console.error('❌ Error saving new lead:', err);
                return res.status(500).json({ error: 'Error saving lead to database' });
            }
            
            console.log(`✅ Added new lead to campaign ${effectiveCampaignId}: ${name} (${formattedPhone})`);
            
            res.json({
                success: true,
                message: 'Lead added successfully',
                lead: {
                    id: dbId,
                    name: callData.contact.name,
                    phone: callData.contact.phone,
                    address: callData.contact.address,
                    campaignId: effectiveCampaignId
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error adding new lead:', error);
        res.status(500).json({ error: 'Error adding lead' });
    }
});

// NEW: Call a specific lead by database ID
app.post('/api/call-lead', express.json(), async (req, res) => {
    try {
        const { dbCallId } = req.body;
        
        if (!dbCallId) {
            return res.status(400).json({ error: 'Database call ID is required' });
        }
        
        // Get call details from database
        DB_HELPERS.getCallByDatabaseId(dbCallId, async (err, call) => {
            if (err || !call) {
                console.error('❌ Error fetching call:', err);
                return res.status(404).json({ error: 'Call not found' });
            }
            
            // Check if call is already in progress
            if (call.status === 'calling' || call.status === 'completed') {
                return res.status(400).json({ error: `Call is already ${call.status}` });
            }
            
            // Make the call
            try {
                const result = await makeVAPICall(
                    call.contact,
                    call.index, // May be null for manual leads
                    call.campaignId,
                    call.assistantId,
                    call.phoneNumberId,
                    dbCallId // Pass database ID for update
                );
                
                if (result.success) {
                    res.json({
                        success: true,
                        message: `Call initiated for ${call.contact.name}`,
                        callId: result.callId
                    });
                } else {
                    res.status(500).json({
                        error: result.error || 'Failed to initiate call'
                    });
                }
            } catch (callError) {
                console.error('❌ Error making call:', callError);
                res.status(500).json({ error: 'Error initiating call' });
            }
        });
        
    } catch (error) {
        console.error('❌ Error calling lead:', error);
        res.status(500).json({ error: 'Error calling lead' });
    }
});

// NEW: Retry selected calls
app.post('/api/retry-selected', express.json(), async (req, res) => {
    try {
        const { dbCallIds } = req.body;
        
        if (!dbCallIds || !Array.isArray(dbCallIds) || dbCallIds.length === 0) {
            return res.status(400).json({ error: 'Array of database call IDs is required' });
        }
        
        const results = [];
        
        // Process each selected call using Promise.all for parallel processing
        const retryPromises = dbCallIds.map(dbCallId => {
            return new Promise((resolve) => {
                // Get call details
                DB_HELPERS.getCallByDatabaseId(dbCallId, async (err, call) => {
                    if (err || !call) {
                        console.error(`❌ Error fetching call ${dbCallId}:`, err);
                        resolve({ dbCallId, success: false, error: 'Call not found' });
                        return;
                    }
                    
                    // For manual leads that haven't been called yet, just call them directly
                    if (!call.callId && call.status === 'scheduled') {
                        // This is a manual lead that hasn't been called - call it directly
                        try {
                            await makeVAPICall(
                                call.contact,
                                call.index,
                                call.campaignId,
                                call.assistantId,
                                call.phoneNumberId,
                                dbCallId
                            );
                            resolve({
                                dbCallId,
                                success: true,
                                contactName: call.contact.name
                            });
                        } catch (callError) {
                            console.error(`❌ Error calling manual lead ${dbCallId}:`, callError);
                            resolve({
                                dbCallId,
                                success: false,
                                error: callError.message
                            });
                        }
                        return;
                    }
                    
                    // Determine original call ID for retry tracking
                    const originalCallId = call.callId || call.originalCallId;
                    const retryCount = call.retryCount || 0;
                    
                    // Create retry call using existing retry function
                    try {
                        await makeRetryCall(
                            call.contact,
                            originalCallId || `db-${dbCallId}`, // Use database ID if no call_id
                            call.campaignId,
                            retryCount,
                            call.assistantId,
                            call.phoneNumberId
                        );
                        
                        resolve({
                            dbCallId,
                            success: true,
                            contactName: call.contact.name
                        });
                    } catch (retryError) {
                        console.error(`❌ Error retrying call ${dbCallId}:`, retryError);
                        resolve({
                            dbCallId,
                            success: false,
                            error: retryError.message
                        });
                    }
                });
            });
        });
        
        // Wait for all retries to complete
        const retryResults = await Promise.all(retryPromises);
        results.push(...retryResults);
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        res.json({
            success: true,
            message: `Retry initiated for ${successCount} call(s). ${failCount} failed.`,
            results: results,
            summary: {
                total: dbCallIds.length,
                success: successCount,
                failed: failCount
            }
        });
        
    } catch (error) {
        console.error('❌ Error retrying selected calls:', error);
        res.status(500).json({ error: 'Error retrying calls' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('📞 VAPI Configuration loaded');
    console.log(`⏳ Call queue configured: Max ${CALL_SYSTEM.maxConcurrent} concurrent calls`);
});

// UPDATED: VAPI webhook endpoint with database persistence
app.post('/webhook/call-ended', (req, res) => {
    try {
        const callData = req.body;
        console.log('📞 Received call outcome webhook:', callData.message?.type || 'unknown type');
        
        // Handle different webhook message types
        if (callData.message?.type === 'end-of-call-report') {
            // Extract data using the actual VAPI structure
            const outcome = {
                callId: callData.message.call?.id,
                endedReason: callData.message.endedReason,
                duration: callData.message.durationSeconds,
                cost: callData.message.cost,
                successEvaluation: callData.message.analysis?.successEvaluation === 'true' ? 'Pass' : 'Fail',
                customerPhoneNumber: callData.message.call?.customer?.number,
                structuredData: callData.message.analysis?.structuredData || null,
                summary: callData.message.analysis?.summary || null,
                recordingUrl: callData.message.recordingUrl || null,  // ← ADD THIS LINE
                timestamp: new Date().toISOString(),
                actualCallTime: new Date().toLocaleTimeString()
            };
            
            // Use CallOutcome from structured data if available, fallback to endedReason
            outcome.callOutcome = outcome.structuredData?.CallOutcome || outcome.endedReason;
            outcome.message = `Call completed: ${outcome.callOutcome} (${outcome.successEvaluation})`;
            
            console.log('🎯 CallOutcome from structured data:', outcome.structuredData?.CallOutcome || 'Not available');
            console.log('📊 Processed end-of-call outcome:', outcome);
            console.log('🏗️ Structured data received:', JSON.stringify(outcome.structuredData, null, 2));
            
            // NEW: Update database with outcome
            if (outcome.callId) {
                DB_HELPERS.updateCallOutcome(outcome.callId, outcome, async (err) => {
                    if (err) {
                        console.error('❌ Error updating call outcome in database:', err);
                    } else {
                        console.log(`💾 Updated call outcome in database for call ID: ${outcome.callId}`);
                        
                        // NEW: Check if outcome is voicemail and schedule retry
                        const isVoicemail = (
                            (outcome.callOutcome && outcome.callOutcome.toLowerCase() === 'voicemail') ||
                            (outcome.endedReason && outcome.endedReason.toLowerCase() === 'voicemail') ||
                            (outcome.structuredData && outcome.structuredData.CallOutcome && outcome.structuredData.CallOutcome.toLowerCase() === 'voicemail')
                        );
                        
                        if (isVoicemail) {
                            console.log('📞 Voicemail detected - scheduling retry in 1 minute');
                            scheduleVoicemailRetry(outcome.callId);
                        }
                        
                        // NEW: Auto-send webhook for specific outcomes
                        const normalizedOutcome = (outcome.callOutcome || outcome.endedReason || '').toLowerCase().trim();
                        const shouldSendWebhook = ['interested', 'send_listings', 'callback'].includes(normalizedOutcome);
                        
                        if (shouldSendWebhook) {
                            // Get call details from database to send to webhook
                            DB_HELPERS.getCallByCallId(outcome.callId, async (err, call) => {
                                if (err || !call) {
                                    console.error('❌ Error fetching call for webhook:', err);
                                    return;
                                }
                                
                                // Get webhook URL
                                try {
                                    const webhookResult = await pool.query(`
                                        SELECT webhook_url FROM webhook_config ORDER BY id DESC LIMIT 1
                                    `);
                                    
                                    if (webhookResult.rows.length > 0 && webhookResult.rows[0].webhook_url) {
                                        // Get assistant name from campaign or assistant table
                                        let assistantName = '';
                                        if (call.campaignId) {
                                            const campaignMeta = await DB_HELPERS.getCampaignById(call.campaignId);
                                            if (campaignMeta && campaignMeta.assistant_name) {
                                                assistantName = campaignMeta.assistant_name;
                                            }
                                        }
                                        
                                        // If not found from campaign, try to get from assistant table
                                        if (!assistantName && call.assistantId) {
                                            const assistant = await DB_HELPERS.getAssistantById(call.assistantId);
                                            if (assistant && assistant.name) {
                                                assistantName = assistant.name;
                                            }
                                        }
                                        
                                        // Prepare webhook payload
                                        const payload = {
                                            contact_name: call.contact.name,
                                            phone_number: call.contact.phone,
                                            address: call.contact.address || '',
                                            call_outcome: call.callOutcome || call.endedReason || '',
                                            call_summary: call.summary || '',
                                            recording: call.recordingUrl || '',
                                            Agent: assistantName || ''
                                        };
                                        
                                        // Send to webhook
                                        try {
                                            const webhookResponse = await axios.post(webhookResult.rows[0].webhook_url, payload, {
                                                headers: { 'Content-Type': 'application/json' },
                                                timeout: 10000,
                                                validateStatus: () => true // Don't throw on any status code
                                            });
                                            
                                            if (webhookResponse.status === 200) {
                                                console.log(`✅ Auto-sent webhook for call ${outcome.callId} with outcome: ${normalizedOutcome} (status: 200)`);
                                            } else {
                                                console.log(`⚠️ Auto-sent webhook for call ${outcome.callId} returned status: ${webhookResponse.status}`);
                                            }
                                        } catch (webhookError) {
                                            console.error('❌ Error sending auto-webhook:', webhookError.message);
                                        }
                                    } else {
                                        console.log('⚠️ Webhook URL not configured - skipping auto-send');
                                    }
                                } catch (webhookError) {
                                    console.error('❌ Error checking webhook config:', webhookError);
                                }
                            });
                        }
                    }
                });
            } else {
                console.log('⚠️ No call ID found in outcome data');
            }
            
        } else {
            console.log(`📝 Received ${callData.message?.type} webhook - no action needed`);
        }
        
        // Respond to VAPI that we received the webhook
        res.status(200).json({ received: true, processed: true });
        
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ error: 'Error processing webhook' });
    }
});

// NEW: Graceful shutdown to close database
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    pool.end((err) => {
        if (err) {
            console.error('❌ Error closing database pool:', err.message);
        } else {
            console.log('📀 Database connection pool closed.');
        }
        process.exit(0);
    });
});

// ==================== ADMIN API ENDPOINTS ====================

// Fetch assistant details from VAPI
app.get('/api/admin/fetch-assistant/:id', async (req, res) => {
    try {
        const assistantId = req.params.id;
        const response = await axios.get(`${VAPI_CONFIG.baseUrl}/assistant/${assistantId}`, {
            headers: {
                'Authorization': `Bearer ${VAPI_CONFIG.privateKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            assistant: {
                id: response.data.id,
                name: response.data.name || response.data.firstMessage || 'Unnamed Assistant',
                description: response.data.model?.provider || null
            }
        });
    } catch (error) {
        console.error('❌ Error fetching assistant from VAPI:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data?.message || error.message || 'Failed to fetch assistant from VAPI' 
        });
    }
});

// Fetch phone number details from VAPI
app.get('/api/admin/fetch-phone/:id', async (req, res) => {
    try {
        const phoneId = req.params.id;
        const response = await axios.get(`${VAPI_CONFIG.baseUrl}/phone-number/${phoneId}`, {
            headers: {
                'Authorization': `Bearer ${VAPI_CONFIG.privateKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            phoneNumber: {
                id: response.data.id,
                displayName: response.data.name || response.data.number || 'Unnamed Phone',
                phoneNumber: response.data.number || null
            }
        });
    } catch (error) {
        console.error('❌ Error fetching phone number from VAPI:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data?.message || error.message || 'Failed to fetch phone number from VAPI' 
        });
    }
});

// Get all assistants (including inactive)
app.get('/api/admin/assistants', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, description, is_active, created_at, updated_at
            FROM assistants
            ORDER BY name ASC
        `);
        res.json({ assistants: result.rows });
    } catch (error) {
        console.error('❌ Error fetching assistants:', error);
        res.status(500).json({ error: 'Error fetching assistants' });
    }
});

// Get all phone numbers (including inactive)
app.get('/api/admin/phone-numbers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, display_name, phone_number, is_active, created_at, updated_at
            FROM phone_numbers
            ORDER BY display_name ASC
        `);
        res.json({ phoneNumbers: result.rows });
    } catch (error) {
        console.error('❌ Error fetching phone numbers:', error);
        res.status(500).json({ error: 'Error fetching phone numbers' });
    }
});

// Add or update assistant
app.post('/api/admin/assistant', express.json(), async (req, res) => {
    try {
        const { id, name, description, isActive } = req.body;
        if (!id || !name) {
            return res.status(400).json({ error: 'ID and name are required' });
        }
        
        await pool.query(`
            INSERT INTO assistants (id, name, description, is_active, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP
        `, [id, name, description || null, isActive !== false]);
        
        res.json({ success: true, message: 'Assistant saved successfully' });
    } catch (error) {
        console.error('❌ Error saving assistant:', error);
        res.status(500).json({ error: 'Error saving assistant' });
    }
});

// Add or update phone number
app.post('/api/admin/phone-number', express.json(), async (req, res) => {
    try {
        const { id, displayName, phoneNumber, isActive } = req.body;
        if (!id || !displayName) {
            return res.status(400).json({ error: 'ID and display name are required' });
        }
        
        await pool.query(`
            INSERT INTO phone_numbers (id, display_name, phone_number, is_active, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                phone_number = EXCLUDED.phone_number,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP
        `, [id, displayName, phoneNumber || null, isActive !== false]);
        
        res.json({ success: true, message: 'Phone number saved successfully' });
    } catch (error) {
        console.error('❌ Error saving phone number:', error);
        res.status(500).json({ error: 'Error saving phone number' });
    }
});

// Toggle assistant active/inactive
app.patch('/api/admin/assistant/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            UPDATE assistants 
            SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING is_active
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assistant not found' });
        }
        
        res.json({ success: true, isActive: result.rows[0].is_active });
    } catch (error) {
        console.error('❌ Error toggling assistant:', error);
        res.status(500).json({ error: 'Error toggling assistant' });
    }
});

// Toggle phone number active/inactive
app.patch('/api/admin/phone-number/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            UPDATE phone_numbers 
            SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING is_active
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Phone number not found' });
        }
        
        res.json({ success: true, isActive: result.rows[0].is_active });
    } catch (error) {
        console.error('❌ Error toggling phone number:', error);
        res.status(500).json({ error: 'Error toggling phone number' });
    }
});

// Delete assistant
app.delete('/api/admin/assistant/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if assistant is used in any campaigns
        const usageCheck = await pool.query(`
            SELECT COUNT(*) as count FROM campaigns WHERE assistant_id = $1
        `, [id]);
        
        if (parseInt(usageCheck.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete assistant that is used in campaigns. Deactivate it instead.' 
            });
        }
        
        await pool.query('DELETE FROM assistants WHERE id = $1', [id]);
        res.json({ success: true, message: 'Assistant deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting assistant:', error);
        res.status(500).json({ error: 'Error deleting assistant' });
    }
});

// Delete phone number
app.delete('/api/admin/phone-number/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if phone number is used in any campaigns
        const usageCheck = await pool.query(`
            SELECT COUNT(*) as count FROM campaigns WHERE phone_number_id = $1
        `, [id]);
        
        if (parseInt(usageCheck.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete phone number that is used in campaigns. Deactivate it instead.' 
            });
        }
        
        await pool.query('DELETE FROM phone_numbers WHERE id = $1', [id]);
        res.json({ success: true, message: 'Phone number deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting phone number:', error);
        res.status(500).json({ error: 'Error deleting phone number' });
    }
});

// Get usage stats for assistant
app.get('/api/admin/assistant/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                COUNT(DISTINCT c.campaign_id) as campaign_count,
                COUNT(c.id) as call_count,
                SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN c.success_evaluation = 'Pass' THEN 1 ELSE 0 END) as successful_count
            FROM calls c
            WHERE c.assistant_id = $1
        `, [id]);
        
        res.json({ stats: result.rows[0] || { campaign_count: 0, call_count: 0, completed_count: 0, successful_count: 0 } });
    } catch (error) {
        console.error('❌ Error fetching assistant stats:', error);
        res.status(500).json({ error: 'Error fetching assistant stats' });
    }
});

// Get usage stats for phone number
app.get('/api/admin/phone-number/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                COUNT(DISTINCT c.campaign_id) as campaign_count,
                COUNT(c.id) as call_count,
                SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN c.success_evaluation = 'Pass' THEN 1 ELSE 0 END) as successful_count
            FROM calls c
            WHERE c.phone_number_id = $1
        `, [id]);
        
        res.json({ stats: result.rows[0] || { campaign_count: 0, call_count: 0, completed_count: 0, successful_count: 0 } });
    } catch (error) {
        console.error('❌ Error fetching phone number stats:', error);
        res.status(500).json({ error: 'Error fetching phone number stats' });
    }
});

// Get webhook URL
app.get('/api/admin/webhook', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT webhook_url, updated_at
            FROM webhook_config
            ORDER BY id DESC
            LIMIT 1
        `);
        
        res.json({ 
            webhookUrl: result.rows.length > 0 ? result.rows[0].webhook_url : null,
            updatedAt: result.rows.length > 0 ? result.rows[0].updated_at : null
        });
    } catch (error) {
        console.error('❌ Error fetching webhook URL:', error);
        res.status(500).json({ error: 'Error fetching webhook URL' });
    }
});

// Set webhook URL
app.post('/api/admin/webhook', express.json(), async (req, res) => {
    try {
        const { webhookUrl } = req.body;
        if (!webhookUrl) {
            return res.status(400).json({ error: 'Webhook URL is required' });
        }
        
        // Validate URL format
        try {
            new URL(webhookUrl);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        // Delete existing webhook and insert new one (only keep one)
        await pool.query('DELETE FROM webhook_config');
        await pool.query(`
            INSERT INTO webhook_config (webhook_url, updated_at)
            VALUES ($1, CURRENT_TIMESTAMP)
        `, [webhookUrl]);
        
        res.json({ success: true, message: 'Webhook URL saved successfully' });
    } catch (error) {
        console.error('❌ Error saving webhook URL:', error);
        res.status(500).json({ error: 'Error saving webhook URL' });
    }
});

// Send contact data to webhook (for manual "Add to CRM" button)
app.post('/api/admin/send-to-webhook', express.json(), async (req, res) => {
    try {
        const { contactId } = req.body;
        if (!contactId) {
            return res.status(400).json({ error: 'Contact ID is required' });
        }
        
        // Get webhook URL
        const webhookResult = await pool.query(`
            SELECT webhook_url FROM webhook_config ORDER BY id DESC LIMIT 1
        `);
        
        if (webhookResult.rows.length === 0 || !webhookResult.rows[0].webhook_url) {
            return res.status(400).json({ error: 'Webhook URL is not configured. Please set it in the admin panel.' });
        }
        
        // Get call data
        DB_HELPERS.getCallByDatabaseId(contactId, async (err, call) => {
            if (err || !call) {
                return res.status(404).json({ error: 'Contact not found' });
            }
            
            // Get assistant name from campaign or assistant table
            let assistantName = '';
            if (call.campaignId) {
                const campaignMeta = await DB_HELPERS.getCampaignById(call.campaignId);
                if (campaignMeta && campaignMeta.assistant_name) {
                    assistantName = campaignMeta.assistant_name;
                }
            }
            
            // If not found from campaign, try to get from assistant table
            if (!assistantName && call.assistantId) {
                const assistant = await DB_HELPERS.getAssistantById(call.assistantId);
                if (assistant && assistant.name) {
                    assistantName = assistant.name;
                }
            }
            
            // Prepare webhook payload
            const payload = {
                contact_name: call.contact.name,
                phone_number: call.contact.phone,
                address: call.contact.address || '',
                call_outcome: call.callOutcome || call.endedReason || '',
                call_summary: call.summary || '',
                recording: call.recordingUrl || '',
                Agent: assistantName || ''
            };
            
            // Send to webhook
            try {
                const webhookResponse = await axios.post(webhookResult.rows[0].webhook_url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000,
                    validateStatus: () => true // Don't throw on any status code
                });
                
                // Return the status code from the webhook response
                res.json({ 
                    success: webhookResponse.status === 200,
                    status: webhookResponse.status,
                    message: webhookResponse.status === 200 
                        ? 'Contact data sent to webhook successfully' 
                        : `Webhook returned status ${webhookResponse.status}`
                });
            } catch (webhookError) {
                console.error('❌ Error sending to webhook:', webhookError.message);
                res.status(500).json({ 
                    success: false,
                    status: null,
                    error: 'Failed to send data to webhook', 
                    details: webhookError.message 
                });
            }
        });
    } catch (error) {
        console.error('❌ Error sending to webhook:', error);
        res.status(500).json({ error: 'Error sending to webhook' });
    }
});

// Update contact information
app.post('/update-contact', express.json(), (req, res) => {
    const { index, field, value } = req.body;
    
    if (!CALL_SYSTEM.currentCampaignId) {
        return res.status(400).json({ error: 'No active campaign' });
    }
    
    const columnMap = {
        'name': 'contact_name',
        'phone': 'contact_phone'
    };
    
    const column = columnMap[field];
    if (!column) {
        return res.status(400).json({ error: 'Invalid field' });
    }
    
    // Format phone number if editing phone
    const finalValue = field === 'phone' ? formatPhoneNumber(value) : value;
    
    // Use parameterized query with column name validation to prevent SQL injection
    // Only allow updating contact_name and contact_phone columns
    if (column !== 'contact_name' && column !== 'contact_phone') {
        return res.status(400).json({ error: 'Invalid field for update' });
    }
    
    pool.query(`
        UPDATE calls SET ${column} = $1
        WHERE campaign_id = $2 AND index_position = $3
    `, [finalValue, CALL_SYSTEM.currentCampaignId, index]).then(result => {
        console.log(`✏️ Updated ${field} for contact at index ${index}: ${finalValue}`);
        res.json({ success: true, updated: result.rowCount });
    }).catch(err => {
        console.error('Error updating contact:', err);
        res.status(500).json({ error: 'Database update failed' });
    });
});