// Primary configuration file for SQL Server credentials
const config = {
    databaseCount: 1,
    databases: [{
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
    }]
};

// Export the configuration
module.exports = config; 