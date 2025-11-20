const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
require('dotenv').config();


// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
   fs.mkdirSync(uploadsDir, { recursive: true });
}


const app = express();
const PORT = process.env.PORT || 3000;


// VAPI Configuration using environment variables
const VAPI_CONFIG = {
   privateKey: process.env.VAPI_PRIVATE_KEY,
   organizationId: process.env.VAPI_ORGANIZATION_ID,
   assistantId: process.env.VAPI_ASSISTANT_ID,
   phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
   baseUrl: 'https://api.vapi.ai'
};


// Call queue and scheduling management
const CALL_SYSTEM = {
   activeCalls: 0,
   maxConcurrent: 10,
   pendingCalls: [],
   callResults: [],
   scheduledCalls: [],
   timers: []
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


// Function to make VAPI call with queue management
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


       const result = {
           success: true,
           contact: contact,
           callId: response.data.id,
           message: `Call initiated for ${contact.name}`,
           timestamp: new Date().toISOString(),
           index: index,
           status: 'completed'
       };
      
       CALL_SYSTEM.callResults[index] = result;
       console.log(`[${index + 1}] ✅ VAPI call successful for ${contact.name}`);
      
       return result;


   } catch (error) {
       const result = {
           success: false,
           contact: contact,
           error: error.message,
           errorDetails: error.response?.data,
           message: `Failed to call ${contact.name}: ${error.message}`,
           timestamp: new Date().toISOString(),
           index: index,
           status: 'failed'
       };
      
       CALL_SYSTEM.callResults[index] = result;
       console.error(`[${index + 1}] ❌ Error making VAPI call for ${contact.name}:`, error.message);
      
       return result;
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


// Function to schedule calls across time window with Eastern timezone
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
  
   // Schedule each call
   contacts.forEach((contact, index) => {
       const callTime = new Date(actualStartTime.getTime() + (intervalMs * index));
       const delayMs = callTime - easternTime;
      
       console.log(`🐛 DEBUG [${index + 1}]: Call time: ${callTime.toLocaleString()}, Delay: ${Math.round(delayMs/1000)}s`);
      
       // Initialize call result as pending
       CALL_SYSTEM.callResults[index] = {
           contact: contact,
           index: index,
           status: 'scheduled',
           scheduledTime: callTime.toISOString(),
           scheduledTimeLocal: callTime.toLocaleTimeString(),
           message: `Scheduled for ${callTime.toLocaleTimeString()}`
       };
      
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


// Handle CSV file upload and processing with time window scheduling
app.post('/upload', upload.single('csvFile'), async (req, res) => {
   if (!req.file) {
       return res.status(400).json({ error: 'No file uploaded' });
   }


  // Get current call status with outcome data
app.get('/status', (req, res) => {
   const totalCalls = CALL_SYSTEM.callResults.length;
   const completedCalls = CALL_SYSTEM.callResults.filter(result => result && result.status === 'completed').length;
   const successfulCalls = CALL_SYSTEM.callResults.filter(result => result && result.successEvaluation === 'Pass').length;
   const failedCalls = CALL_SYSTEM.callResults.filter(result => result && result.successEvaluation === 'Fail').length;
   const activeCalls = CALL_SYSTEM.activeCalls;
   const pendingCalls = CALL_SYSTEM.pendingCalls.length;
   const scheduledCalls = CALL_SYSTEM.callResults.filter(result => result && result.status === 'scheduled').length;
  
   res.json({
       calls: CALL_SYSTEM.callResults,
       summary: {
           total: totalCalls,
           completed: completedCalls,
           successful: successfulCalls,
           failed: failedCalls,
           active: activeCalls,
           pending: pendingCalls,
           scheduled: scheduledCalls
       },
       timers: CALL_SYSTEM.timers.length
   });
});
  
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
      
       // Update scheduled calls status to cancelled
       CALL_SYSTEM.callResults.forEach((result, index) => {
           if (result && result.status === 'scheduled') {
               result.status = 'cancelled';
               result.message = 'Call cancelled by user';
           }
       });
      
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
  
   // Reset call system for new batch
   CALL_SYSTEM.timers.forEach(timer => clearTimeout(timer));
   CALL_SYSTEM.timers = [];
   CALL_SYSTEM.pendingCalls = [];
   CALL_SYSTEM.callResults = [];
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
          
           // Initialize call results array
           CALL_SYSTEM.callResults = new Array(contacts.length);
          
           // Schedule calls across the time window
           scheduleCallsAcrossTimeWindow(contacts, startTime, endTime);
          
           // Send response immediately
           res.json({
               message: `Calls scheduled successfully across time window!`,
               totalContacts: contacts.length,
               windowHours: windowHours,
               startTime: startTime,
               endTime: endTime,
               maxConcurrent: CALL_SYSTEM.maxConcurrent,
               intervalMinutes: Math.round((windowHours * 60) / Math.max(1, contacts.length - 1))
           });
       })
       .on('error', (error) => {
           console.error('❌ Error processing CSV:', error);
           res.status(500).json({ error: 'Error processing CSV file' });
       });
});


// Start server
app.listen(PORT, () => {
   console.log(`🚀 Server running on port ${PORT}`);
   console.log('📞 VAPI Configuration loaded');
   console.log(`⏳ Call queue configured: Max ${CALL_SYSTEM.maxConcurrent} concurrent calls`);
});


// Middleware to parse JSON bodies
app.use(express.json());


// VAPI webhook endpoint for call outcomes
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
               structuredData: callData.message.analysis?.structuredData || null, // This is the correct path
               summary: callData.message.analysis?.summary || null,
               timestamp: new Date().toISOString(),
               actualCallTime: new Date().toLocaleTimeString()
           };
          
           console.log('🎯 CallOutcome from structured data:', outcome.structuredData?.CallOutcome || 'Not available');
           console.log('📊 Processed end-of-call outcome:', outcome);
           console.log('🏗️ Structured data received:', JSON.stringify(outcome.structuredData, null, 2));
          
           // Find and update the corresponding call in our system
           const callIndex = CALL_SYSTEM.callResults.findIndex(result =>
               result && result.callId === outcome.callId
           );
          
           if (callIndex !== -1 && CALL_SYSTEM.callResults[callIndex]) {
               // Update the call result with outcome data
           CALL_SYSTEM.callResults[callIndex] = {
               ...CALL_SYSTEM.callResults[callIndex],
               endedReason: outcome.endedReason,
               duration: outcome.duration,
               cost: outcome.cost,
               successEvaluation: outcome.successEvaluation,
               structuredData: outcome.structuredData,
               summary: outcome.summary,
               actualCallTime: outcome.actualCallTime,
               status: 'completed',
               success: outcome.successEvaluation === 'Pass',
               outcomeReceived: true,
               // Use CallOutcome from structured data if available, fallback to endedReason
               callOutcome: outcome.structuredData?.CallOutcome || outcome.endedReason,
               message: `Call completed: ${outcome.structuredData?.CallOutcome || outcome.endedReason} (${outcome.successEvaluation})`
           };
              
               console.log(`✅ Updated call result for index ${callIndex} with structured outcome data`);
           } else {
               console.log('⚠️ Could not find matching call for outcome', outcome.callId);
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

