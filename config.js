// Primary configuration loader for SQL Server credentials.
// This file reads environment variables (from .env) and supports
// encrypted passwords using the utils/crypto.decrypt helper.
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { decrypt } = require('./utils/crypto');

function readEnv() {
    const dbCount = parseInt(process.env.DATABASE_COUNT || '0', 10) || 0;
    const databases = [];

    for (let i = 0; i < dbCount; i++) {
        const prefix = `DB${i}_`;
        const name = process.env[`${prefix}NAME`] || `DB${i + 1}`;
        const sqlServer = process.env[`${prefix}SQL_SERVER`] || '';
        const sqlDatabase = process.env[`${prefix}SQL_DATABASE`] || '';
        const sqlUser = process.env[`${prefix}SQL_USER`] || '';
        const rawPassword = process.env[`${prefix}SQL_PASSWORD`] || '';
        const sqlTrust = (process.env[`${prefix}SQL_TRUST_SERVER_CERTIFICATE`] || 'true') === 'true';

        let sqlPassword = rawPassword;
        if (rawPassword && rawPassword.startsWith('ENC:')) {
            try {
                sqlPassword = decrypt(rawPassword, process.env.SECRET_KEY);
            } catch (err) {
                console.error('Failed to decrypt database password for', name, err.message);
                // fall back to raw value (will likely fail auth)
                sqlPassword = rawPassword;
            }
        }

        databases.push({
            name,
            sqlServer,
            sqlDatabase,
            sqlUser,
            sqlPassword,
            sqlTrustServerCertificate: sqlTrust,
            options: {
                encrypt: false,
                trustServerCertificate: sqlTrust,
                enableArithAbort: true
            }
        });
    }

    // If no env-configured databases, provide a default compatible object
    if (databases.length === 0) {
        databases.push({
            name: 'Opus',
            sqlServer: '192.168.40.6\\opus',
            sqlDatabase: 'opus',
            sqlUser: 'sa',
            sqlPassword: 'Opus2008',
            sqlTrustServerCertificate: true,
            options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
            }
        });
    }

    return {
        databaseCount: databases.length,
        databases
    };
}

module.exports = readEnv();