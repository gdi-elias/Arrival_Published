const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const questions = [
    {
        name: 'databaseCount',
        question: 'How many databases do you want to configure? (default: 1): ',
        default: '1'
    },
    {
        name: 'name',
        question: 'Database name (e.g., Opus): ',
        default: 'Opus'
    },
    {
        name: 'sqlServer',
        question: 'SQL Server (e.g., 192.168.40.6\\opus): ',
        default: '192.168.40.6\\opus'
    },
    {
        name: 'sqlDatabase',
        question: 'Database name (e.g., opus): ',
        default: 'opus'
    },
    {
        name: 'sqlUser',
        question: 'SQL User (e.g., sa): ',
        default: 'sa'
    },
    {
        name: 'sqlPassword',
        question: 'SQL Password (e.g., Opus2008): ',
        default: 'Opus2008'
    },
    {
        name: 'sqlTrustServerCertificate',
        question: 'Trust Server Certificate? (true/false): ',
        default: 'true'
    }
];

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question.question, (answer) => {
            resolve(answer || question.default);
        });
    });
}

async function main() {
    try {
        console.log('Database Configuration Setup');
        console.log('===========================');

        const databaseCount = parseInt(await askQuestion(questions[0]));
        const envContent = [`DATABASE_COUNT=${databaseCount}`];

        for (let i = 1; i <= databaseCount; i++) {
            console.log(`\nDatabase ${i} Configuration:`);
            const dbConfig = {};
            
            for (let j = 1; j < questions.length; j++) {
                const answer = await askQuestion(questions[j]);
                const prefix = `DB${i}_`;
                const key = questions[j].name.toUpperCase();
                envContent.push(`${prefix}${key}=${answer}`);
            }
        }

        fs.writeFileSync('.env', envContent.join('\n'));
        console.log('\nConfiguration saved to .env file successfully!');
        
        rl.close();
    } catch (error) {
        console.error('Error during setup:', error);
        rl.close();
    }
}

main(); 