const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose(); // NEW: Import SQLite
require('dotenv').config();

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// NEW: Database setup
const dbPath = './calls.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
    } else {
        console.log('📀 Connected to SQLite database:', dbPath);
        initializeDatabase();
    }
});

// NEW: Initialize database tables
function initializeDatabase() {
    // Create calls table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_name TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            contact_address TEXT,
            call_id TEXT,
            status TEXT DEFAULT 'scheduled',
            scheduled_time TEXT,
            scheduled_time_local TEXT,
            ended_reason TEXT,
            call_outcome TEXT,
            duration REAL,
            cost REAL,
            success_evaluation TEXT,
            structured_data TEXT,
            summary TEXT,
            actual_call_time TEXT,
            message TEXT,
            timestamp TEXT,
            campaign_id TEXT,
            index_position INTEGER,
            outcome_received INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating calls table:', err.message);
        } else {
            console.log('✅ Database table initialized');
        }
    });
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
    currentCampaignId: null // NEW: Track current campaign
};

// NEW: Database helper functions
const DB_HELPERS = {
    // Save a call to database
    saveCall: (callData, callback) => {
        const stmt = db.prepare(`
            INSERT INTO calls (
                contact_name, contact_phone, contact_address, call_id, status,
                scheduled_time, scheduled_time_local, message, timestamp,
                campaign_id, index_position
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
            callData.contact.name,
            formatPhoneNumber(callData.contact.phone),  // ← ADD formatPhoneNumber HERE
            callData.contact.address || '',
            callData.callId || null,
            callData.status,
            callData.scheduledTime || null,
            callData.scheduledTimeLocal || null,
            callData.message || '',
            callData.timestamp,
            CALL_SYSTEM.currentCampaignId,
            callData.index
        ], function(err) {
            if (callback) callback(err, this.lastID);
        });
        
        stmt.finalize();
    },
    
    // Update call with outcome data
    updateCallOutcome: (callId, outcomeData, callback) => {
        const stmt = db.prepare(`
            UPDATE calls SET 
                ended_reason = ?, call_outcome = ?, duration = ?, cost = ?,
                success_evaluation = ?, structured_data = ?, summary = ?,
                actual_call_time = ?, status = ?, outcome_received = 1,
                message = ?
            WHERE call_id = ?
        `);
        
        stmt.run([
            outcomeData.endedReason,
            outcomeData.callOutcome,
            outcomeData.duration,
            outcomeData.cost,
            outcomeData.successEvaluation,
            JSON.stringify(outcomeData.structuredData),
            outcomeData.summary,
            outcomeData.actualCallTime,
            'completed',
            outcomeData.message,
            callId
        ], callback);
        
        stmt.finalize();
    },
    
    // Get all calls for current campaign
    getCurrentCalls: (callback) => {
        db.all(`
            SELECT * FROM calls 
            WHERE campaign_id = ? 
            ORDER BY index_position
        `, [CALL_SYSTEM.currentCampaignId], (err, rows) => {
            if (err) {
                console.error('❌ Error fetching calls:', err);
                callback(err, []);
                return;
            }
            
            // Convert database rows back to our format
            const calls = rows.map(row => ({
                contact: {
                    name: row.contact_name,
                    phone: row.contact_phone,
                    address: row.contact_address
                },
                callId: row.call_id,
                status: row.status,
                scheduledTime: row.scheduled_time,
                scheduledTimeLocal: row.scheduled_time_local,
                endedReason: row.ended_reason,
                callOutcome: row.call_outcome,
                duration: row.duration,
                cost: row.cost,
                successEvaluation: row.success_evaluation,
                structuredData: row.structured_data ? JSON.parse(row.structured_data) : null,
                summary: row.summary,
                actualCallTime: row.actual_call_time,
                message: row.message,
                timestamp: row.timestamp,
                index: row.index_position,
                outcomeReceived: row.outcome_received === 1,
                success: row.success_evaluation === 'Pass'
            }));
            
            callback(null, calls);
        });
    },
    
    // Clear old campaign data (optional - for cleanup)
    clearOldCampaigns: (daysOld = 7) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        db.run(`
            DELETE FROM calls 
            WHERE timestamp < ? 
            AND status IN ('completed', 'cancelled', 'failed')
        `, [cutoffDate.toISOString()], function(err) {
            if (!err && this.changes > 0) {
                console.log(`🧹 Cleaned up ${this.changes} old call records`);
            }
        });
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
async function makeVAPICall(contact, index) {
    try {
        CALL_SYSTEM.activeCalls++;
        
        const callData = {
            assistantId: VAPI_CONFIG.assistantId,
            phoneNumberId: VAPI_CONFIG.phoneNumberId,
            customer: {
                number: formatPhoneNumber(contact.phone)
            },
            assistantOverrides: {
                variableValues: {
                    name: contact.name,
                    "customer.number": formatPhoneNumber(contact.phone),
                    address: contact.address
                }
            }
        };

        console.log(`[${index + 1}] 📞 Making VAPI call for: ${contact.name} ${formatPhoneNumber(contact.phone)}`);

        const response = await axios.post(`${VAPI_CONFIG.baseUrl}/call`, callData, {
            headers: {
                'Authorization': `Bearer ${VAPI_CONFIG.privateKey}`,
                'Content-Type': 'application/json'
            }
        });

        // NEW: Update database with call ID - FIXED VERSION
        const phoneNumber = formatPhoneNumber(contact.phone);
        console.log(`🔧 Updating database: phone=${phoneNumber}, campaign=${CALL_SYSTEM.currentCampaignId}, index=${index}, callId=${response.data.id}`);
        
        // Update in database with better error handling
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE calls SET 
                    call_id = ?, status = ?, message = ?, timestamp = ?
                WHERE contact_phone = ? AND campaign_id = ? AND index_position = ?
            `, [
                response.data.id, 'calling', `Call initiated for ${contact.name}`, new Date().toISOString(),
                phoneNumber, CALL_SYSTEM.currentCampaignId, index
            ], function(err) {
                if (err) {
                    console.error('❌ Error updating call with call_id:', err);
                    reject(err);
                } else {
                    console.log(`💾 Updated ${this.changes} database records with call_id for ${contact.name}`);
                    if (this.changes === 0) {
                        console.log(`⚠️ No database records updated for ${contact.name}`);
                        console.log(`   Expected: phone=${phoneNumber}, campaign=${CALL_SYSTEM.currentCampaignId}, index=${index}`);
                        
                        // Let's see what's actually in the database
                        db.all(`SELECT contact_phone, campaign_id, index_position FROM calls WHERE campaign_id = ?`, 
                               [CALL_SYSTEM.currentCampaignId], (err, rows) => {
                            if (!err) {
                                console.log('   Database contents:', rows);
                            }
                        });
                    }
                    resolve();
                }
            });
        });

        console.log(`[${index + 1}] ✅ VAPI call successful for ${contact.name}`);
        
        return {
            success: true,
            contact: contact,
            callId: response.data.id,
            message: `Call initiated for ${contact.name}`,
            timestamp: new Date().toISOString(),
            index: index,
            status: 'calling'
        };

    } catch (error) {
        // Update database with error
        const phoneNumber = formatPhoneNumber(contact.phone);
        db.run(`
            UPDATE calls SET 
                status = ?, message = ?
            WHERE contact_phone = ? AND campaign_id = ? AND index_position = ?
        `, [
            'failed', `Failed to call ${contact.name}: ${error.message}`,
            phoneNumber, CALL_SYSTEM.currentCampaignId, index
        ], function(updateErr) {
            if (updateErr) {
                console.error('❌ Error updating failed call in database:', updateErr);
            } else {
                console.log(`💾 Updated ${this.changes} failed call records for ${contact.name}`);
            }
        });

        console.error(`[${index + 1}] ❌ Error making VAPI call for ${contact.name}:`, error.message);
        
        return {
            success: false,
            contact: contact,
            error: error.message,
            message: `Failed to call ${contact.name}: ${error.message}`,
            timestamp: new Date().toISOString(),
            index: index,
            status: 'failed'
        };
    } finally {
        CALL_SYSTEM.activeCalls--;
        processNextCall();
    }
}

// Function to process next call in queue
function processNextCall() {
    if (CALL_SYSTEM.activeCalls < CALL_SYSTEM.maxConcurrent && CALL_SYSTEM.pendingCalls.length > 0) {
        const nextCall = CALL_SYSTEM.pendingCalls.shift();
        makeVAPICall(nextCall.contact, nextCall.index);
    }
}

// Function to queue call with concurrency control
function queueCall(contact, index) {
    if (CALL_SYSTEM.activeCalls < CALL_SYSTEM.maxConcurrent) {
        makeVAPICall(contact, index);
    } else {
        CALL_SYSTEM.pendingCalls.push({ contact, index });
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
            queueCall(contact, index);
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
            timestamp: new Date().toISOString()
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
            queueCall(contact, index);
        } else {
            console.log(`[${index + 1}] ⏰ Scheduled ${contact.name} for ${callTime.toLocaleTimeString()} (in ${Math.round(delayMs/1000)}s)`);
            
            const timer = setTimeout(() => {
                console.log(`[${index + 1}] 🔔 Timer fired! Time to call ${contact.name}`);
                queueCall(contact, index);
            }, delayMs);
            
            CALL_SYSTEM.timers.push(timer);
        }
    });
    
    console.log(`🐛 DEBUG: Set ${CALL_SYSTEM.timers.length} timers`);
}

// Serve static files from public directory
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// UPDATED: Get current call status from database
app.get('/status', (req, res) => {
    // If no current campaign, try to load the most recent one
    if (!CALL_SYSTEM.currentCampaignId) {
        db.get(`
            SELECT campaign_id FROM calls 
            ORDER BY timestamp DESC 
            LIMIT 1
        `, (err, row) => {
            if (!err && row) {
                CALL_SYSTEM.currentCampaignId = row.campaign_id;
                console.log('🔄 Auto-loaded most recent campaign:', CALL_SYSTEM.currentCampaignId);
            }
            getCalls();
        });
    } else {
        getCalls();
    }
    
    function getCalls() {
        DB_HELPERS.getCurrentCalls((err, calls) => {
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
                campaignId: CALL_SYSTEM.currentCampaignId
            });
        });
    }
});

// Handle CSV file upload and processing with time window scheduling
app.post('/upload', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;
    
    if (!startTime || !endTime) {
        return res.status(400).json({ error: 'Start time and end time are required' });
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
    console.log('🎯 Created new campaign:', CALL_SYSTEM.currentCampaignId);
    
    // Cancel existing timers
    CALL_SYSTEM.timers.forEach(timer => clearTimeout(timer));
    CALL_SYSTEM.timers = [];
    CALL_SYSTEM.pendingCalls = [];
    CALL_SYSTEM.activeCalls = 0;
    
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
                campaignId: CALL_SYSTEM.currentCampaignId
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
            db.run(`
                UPDATE calls SET 
                    status = 'cancelled', 
                    message = 'Call cancelled by user'
                WHERE campaign_id = ? AND status = 'scheduled'
            `, [CALL_SYSTEM.currentCampaignId], function(err) {
                if (err) {
                    console.error('❌ Error updating cancelled calls in database:', err);
                } else {
                    console.log(`💾 Updated ${this.changes} cancelled calls in database`);
                }
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('📞 VAPI Configuration loaded');
    console.log(`⏳ Call queue configured: Max ${CALL_SYSTEM.maxConcurrent} concurrent calls`);
});

// Middleware to parse JSON bodies
app.use(express.json());

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
                DB_HELPERS.updateCallOutcome(outcome.callId, outcome, (err) => {
                    if (err) {
                        console.error('❌ Error updating call outcome in database:', err);
                    } else {
                        console.log(`💾 Updated call outcome in database for call ID: ${outcome.callId}`);
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
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('📀 Database connection closed.');
        }
        process.exit(0);
    });
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
    
    db.run(`
        UPDATE calls SET ${column} = ?
        WHERE campaign_id = ? AND index_position = ?
    `, [finalValue, CALL_SYSTEM.currentCampaignId, index], function(err) {
        if (err) {
            console.error('Error updating contact:', err);
            res.status(500).json({ error: 'Database update failed' });
        } else {
            console.log(`✏️ Updated ${field} for contact at index ${index}: ${finalValue}`);
            res.json({ success: true, updated: this.changes });
        }
    });
});