# Dental Office Check-in System

A simple web-based check-in system for dental offices that connects directly to SQL Server.

## Prerequisites

- Node.js (v14 or higher)
- SQL Server
- Access to the database with appropriate permissions
- npm (comes with Node.js)

## Setup

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Run the setup script to create your `.env` file:
   ```bash
   node setup.js
   ```
   The script will guide you through entering your SQL Server credentials.

3. Make sure the database and view `BokanirDagsins` exist in your SQL Server.

## Running the Application

1. Start the server:
   ```bash
   node server.js
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Features

- Simple numpad interface for entering social security numbers
- Direct connection to SQL Server for appointment verification
- Responsive design that works on all devices
- Error handling and user feedback

## Security Notes

- Never commit the `.env` file to version control
- Keep the `.env` file secure and restrict access to it
- Use strong passwords for SQL Server authentication
- Consider using Windows Authentication instead of SQL Server authentication if possible
- Regularly rotate database credentials

## Troubleshooting

If you encounter connection issues:
1. Verify your SQL Server is running
2. Check the credentials in your `.env` file
3. Ensure the database and view exist
4. Check firewall settings if connecting to a remote server

If you encounter any other issues:

1. Check the SQL Server connection settings
2. Ensure the SQL Server is accessible from the application
3. Check the console for any error messages
4. Verify that all required ports are open
5. Check the credentials in your `.env` file
6. Ensure the database and view exist
7. Check firewall settings if connecting to a remote server 