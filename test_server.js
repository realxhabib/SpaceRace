// test_server.js - Run server for testing
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the server
console.log('Starting server...');
const server = exec('node server.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});

server.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
});

server.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.kill();
    process.exit();
}); 