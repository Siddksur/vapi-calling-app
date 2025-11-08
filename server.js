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

// Function to format phone number to E.164 format
function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // If it's 10 digits, assume it's a US/Canada number and add +1
    if (digitsOnly.length === 10) {
        return `+1${digitsOnly}`;
    }
    
    // If it's 11 digits starting with 1, add the +
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return `+${digitsOnly}`;
    }
    
    // If it already starts with +, return as is
    if (phone.startsWith('+')) {
        return phone;
    }
    
    // For other cases, assume US/Canada and add +1
    return `+1${digitsOnly}`;
}

// Serve static files from public directory
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to make VAPI call
async function makeVAPICall(contact) {
    try {
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

        console.log('Making VAPI call for:', contact.name, formatPhoneNumber(contact.phone));
        console.log('Call data:', JSON.stringify(callData, null, 2));

        const response = await axios.post(`${VAPI_CONFIG.baseUrl}/call`, callData, {
            headers: {
                'Authorization': `Bearer ${VAPI_CONFIG.privateKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('VAPI call initiated successfully for', contact.name);
        console.log('Call ID:', response.data.id);
        return {
            success: true,
            contact: contact,
            callId: response.data.id,
            message: `Call initiated for ${contact.name}`
        };

    } catch (error) {
        console.error('Error making VAPI call for', contact.name, ':', error.message);
        
        // Log more detailed error information
        if (error.response) {
            console.error('Error status:', error.response.status);
            console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        }
        
        return {
            success: false,
            contact: contact,
            error: error.message,
            errorDetails: error.response?.data,
            message: `Failed to call ${contact.name}: ${error.message}`
        };
    }
}

// Handle CSV file upload and processing
app.post('/upload', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File uploaded:', req.file.filename);
    
    // Process the CSV file
    const contacts = [];
    const filePath = req.file.path;
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            // Add each row to contacts array
            contacts.push({
                name: row.Name || row.name,
                phone: row.Phone || row.phone,
                address: row.Address || row.address
            });
        })
        .on('end', async () => {
            console.log('CSV processing complete. Found', contacts.length, 'contacts');
            
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            
            // Start making VAPI calls for each contact
            const results = [];
            
            for (let i = 0; i < contacts.length; i++) {
                const contact = contacts[i];
                console.log(`Processing contact ${i + 1}/${contacts.length}: ${contact.name}`);
                
                const result = await makeVAPICall(contact);
                results.push(result);
                
                // Add a small delay between calls to avoid rate limiting
                if (i < contacts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Send response with all results
            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;
            
            res.json({ 
                message: `Processing complete! ${successCount} calls initiated, ${failureCount} failed.`,
                totalContacts: contacts.length,
                successCount: successCount,
                failureCount: failureCount,
                results: results
            });
        })
        .on('error', (error) => {
            console.error('Error processing CSV:', error);
            res.status(500).json({ error: 'Error processing CSV file' });
        });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('VAPI Configuration loaded');
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});