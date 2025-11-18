const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const fs = require('fs');
const { encrypt } = require('./utils/crypto');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for logo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename for each logo
        const timestamp = Date.now();
        cb(null, `logo_${timestamp}.png`);
    }
});
const upload = multer({ storage: storage });

// Multiple SQL Server configurations
const dbConfigs = [
    {
        name: 'Opus',
        config: {
            user: 'sa',
            password: 'Opus2008',
            server: '192.168.40.6\\opus',
            database: 'opus',
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        }
    },
    // Add more database configurations here
    // {
    //     name: 'AnotherDB',
    //     config: {
    //         user: 'username',
    //         password: 'password',
    //         server: 'server',
    //         database: 'database',
    //         options: {
    //             encrypt: false,
    //             trustServerCertificate: true
    //         }
    //     }
    // }
];

// Store SSN in memory (for demo purposes)
let currentSSN = '';

// SQL Server configuration
const sqlConfig = {
    user: config.sqlUser,
    password: config.sqlPassword,
    database: config.sqlDatabase,
    server: config.sqlServer,
    trustServerCertificate: config.sqlTrustServerCertificate,
    options: {
        encrypt: true,
        enableArithAbort: true
    }
};

// Format SSN in Icelandic kennitala format (6 digits, dash, 4 digits)
function formatSSN(ssn) {
    if (ssn.length >= 6) {
        return ssn.slice(0, 6) + '-' + ssn.slice(6, 10);
    }
    return ssn;
}

// Function to check appointment in a specific database
async function checkAppointmentInDB(dbConfig, formattedSSN) {
    try {
        const pool = await sql.connect({
            user: dbConfig.sqlUser,
            password: dbConfig.sqlPassword,
            database: dbConfig.sqlDatabase,
            server: dbConfig.sqlServer,
            ...dbConfig.options
        });

        const result = await pool.request()
            .input('ssn', sql.NVarChar, formattedSSN)
            .query(`
                SELECT DisplayedName, Start, PatientHasArrived 
                FROM BokanirDagsins 
                WHERE DisplayedPersonalNo = @ssn`);

        return {
            dbName: dbConfig.name,
            result: result.recordset
        };
    } catch (err) {
        console.error(`Error checking ${dbConfig.name}:`, err);
        return {
            dbName: dbConfig.name,
            error: err.message
        };
    } finally {
        sql.close();
    }
}

// API endpoints
app.post('/api/addDigit', (req, res) => {
    const { digit } = req.body;
    if (currentSSN.length < 10) { // Only allow 10 digits
        currentSSN += digit;
    }
    res.json({ ssn: formatSSN(currentSSN) });
});

app.post('/api/clear', (req, res) => {
    currentSSN = '';
    res.json({ ssn: '' });
});

app.post('/api/checkAppointment', async (req, res) => {
    if (!currentSSN) {
        return res.json({ success: false, message: "Please enter your social security number" });
    }

    try {
        const formattedSSN = formatSSN(currentSSN);
        console.log('Checking appointment for SSN:', formattedSSN);

        // Check all databases in parallel
        const results = await Promise.all(
            config.databases.map(dbConfig => checkAppointmentInDB(dbConfig, formattedSSN))
        );

        // Find the first successful result
        const successfulResult = results.find(r => r.result && r.result.length > 0);

        if (successfulResult) {
            const appointment = successfulResult.result[0];
            const appointmentTime = new Date(appointment.Start).toLocaleTimeString('is-IS', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            // Mark the patient as arrived
            try {
                const pool = await sql.connect({
                    user: config.databases.find(db => db.name === successfulResult.dbName).sqlUser,
                    password: config.databases.find(db => db.name === successfulResult.dbName).sqlPassword,
                    database: config.databases.find(db => db.name === successfulResult.dbName).sqlDatabase,
                    server: config.databases.find(db => db.name === successfulResult.dbName).sqlServer,
                    trustServerCertificate: config.databases.find(db => db.name === successfulResult.dbName).sqlTrustServerCertificate,
                    options: {
                        encrypt: true,
                        enableArithAbort: true
                    }
                });

                const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                const updateResult = await pool.request()
                    .input('ssn', sql.NVarChar, formattedSSN)
                    .input('arrivalTime', sql.NVarChar, currentTime)
                    .query(`
                        UPDATE bo
                        SET bo.PatientHasArrived = @arrivalTime
                        FROM BookingObject bo
                        INNER JOIN MainActor ma ON bo.Actor_ID = ma.ActorID
                        WHERE ma.DisplayedPersonalNo = @ssn
                        AND bo.Start >= DATEADD(DAY, -1, GETUTCDATE())
                        AND bo.Start <= DATEADD(DAY, 1, GETUTCDATE())
                        AND bo.Status = 1
                        AND (bo.PatientHasArrived IS NULL OR bo.PatientHasArrived = '')`);

                console.log('Update result:', updateResult);
            } catch (err) {
                console.error(`Error marking arrived in ${successfulResult.dbName}:`, err);
            } finally {
                sql.close();
            }
            
            const response = { 
                success: true, 
                code: "APPOINTMENT_FOUND",
                patientName: appointment.DisplayedName,
                appointmentTime: appointmentTime,
                hasArrived: true,
                dbName: successfulResult.dbName
            };
            
            // Clear the SSN after successful check
            currentSSN = '';
            res.json(response);
        } else {
            // Check if any database had an error
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.error('Database errors:', errors);
            }
            
            // Clear the SSN after unsuccessful check
            currentSSN = '';
            res.json({ 
                success: false, 
                code: "NO_APPOINTMENT"
            });
        }
    } catch (err) {
        console.error('General error:', err);
        res.json({ success: false, message: "An error occurred. Please try again later." });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the admin interface
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Get current database configurations
app.get('/api/config', (req, res) => {
    res.json(config.databases);
});

// Save database configurations
app.post('/api/config', async (req, res) => {
    try {
        const newDatabases = req.body;
        
        // Validate the new configurations
        for (const db of newDatabases) {
            if (!db.name || !db.sqlServer || !db.sqlDatabase || !db.sqlUser || !db.sqlPassword) {
                return res.status(400).json({ error: 'Missing required fields in database configuration' });
            }
        }

        // Update the configuration
        config.databaseCount = newDatabases.length;
        config.databases = newDatabases;

        // Save to .env file
        // If SECRET_KEY is provided, encrypt passwords before saving.
        const envContent = [`DATABASE_COUNT=${config.databaseCount}`];
        const secret = process.env.SECRET_KEY || null;
        config.databases.forEach((db, index) => {
            const prefix = `DB${index + 1}_`;
            envContent.push(`${prefix}NAME=${db.name}`);
            envContent.push(`${prefix}SQL_SERVER=${db.sqlServer}`);
            envContent.push(`${prefix}SQL_DATABASE=${db.sqlDatabase}`);
            envContent.push(`${prefix}SQL_USER=${db.sqlUser}`);
            try {
                const toStore = (secret && db.sqlPassword) ? encrypt(db.sqlPassword, secret) : db.sqlPassword;
                envContent.push(`${prefix}SQL_PASSWORD=${toStore}`);
            } catch (err) {
                console.error('Failed to encrypt password for', db.name, err.message);
                // fallback to plaintext if encryption fails
                envContent.push(`${prefix}SQL_PASSWORD=${db.sqlPassword}`);
            }
            envContent.push(`${prefix}SQL_TRUST_SERVER_CERTIFICATE=${db.sqlTrustServerCertificate}`);
        });

        fs.writeFileSync('.env', envContent.join('\n'));
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving configurations:', error);
        res.status(500).json({ error: 'Failed to save configurations' });
    }
});

// Test database connection
app.post('/api/test-connection', async (req, res) => {
    try {
        const dbConfig = req.body;
        const pool = await sql.connect({
            user: dbConfig.sqlUser,
            password: dbConfig.sqlPassword,
            database: dbConfig.sqlDatabase,
            server: dbConfig.sqlServer,
            options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
            }
        });

        // Test the connection by running a simple query
        await pool.request().query('SELECT 1');
        sql.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Connection test failed:', error);
        res.json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get all logos endpoint
app.get('/api/logos', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const logos = files
            .filter(file => file.startsWith('logo_'))
            .map(file => ({
                filename: file,
                url: `/uploads/${file}`
            }));
        res.json({ success: true, logos });
    } catch (err) {
        console.error('Error getting logos:', err);
        res.status(500).json({ success: false, error: 'Failed to get logos' });
    }
});

// Upload logo endpoint
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        // Return the URL where the logo can be accessed
        const url = `/uploads/${req.file.filename}`;
        res.json({ success: true, filename: req.file.filename, url });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

// Delete logo endpoint
app.delete('/api/logo/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename.startsWith('logo_')) {
            return res.status(400).json({ success: false, error: 'Invalid logo filename' });
        }
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Logo not found' });
        }
    } catch (err) {
        console.error('Error deleting logo:', err);
        res.status(500).json({ success: false, error: 'Failed to delete logo' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 