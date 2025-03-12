// server-launcher.js - A simple launcher for the game server
const { spawn } = require('child_process');
const { exec } = require('child_process');
const path = require('path');

console.log('======================================');
console.log('Space Race Game Server Launcher');
console.log('======================================');
console.log();

// Helper function to kill previous server processes
async function killPrevServers() {
  return new Promise((resolve) => {
    console.log('Checking for previous server processes...');
    
    // Windows-specific command to find server processes
    const command = 'tasklist /fi "imagename eq node.exe" /fo csv /nh';
    
    exec(command, (error, stdout) => {
      if (error) {
        console.error('Error checking for processes:', error);
        resolve();
        return;
      }
      
      // Parse the CSV output to find node processes
      const lines = stdout.trim().split('\n');
      const nodeProcesses = lines
        .filter(line => line.includes('node.exe'))
        .map(line => {
          // Extract PID from CSV format
          const match = line.match(/"node.exe","(\d+)"/);
          return match ? match[1] : null;
        })
        .filter(pid => pid !== null && pid !== process.pid.toString());
      
      if (nodeProcesses.length === 0) {
        console.log('No previous server processes found.');
        resolve();
        return;
      }
      
      console.log(`Found ${nodeProcesses.length} previous Node.js processes.`);
      
      // Kill each process
      let killedCount = 0;
      nodeProcesses.forEach(pid => {
        const killCmd = `taskkill /F /PID ${pid}`;
        exec(killCmd, (killErr) => {
          killedCount++;
          if (killErr) {
            console.log(`Could not terminate process ${pid}`);
          } else {
            console.log(`Terminated process ${pid}`);
          }
          
          if (killedCount === nodeProcesses.length) {
            console.log('Process cleanup complete.');
            resolve();
          }
        });
      });
      
      // If no processes to kill, resolve immediately
      if (nodeProcesses.length === 0) {
        resolve();
      }
    });
  });
}

// Main function to start the server
async function startServer() {
  try {
    // First kill any previous server processes
    await killPrevServers();
    
    console.log('\nStarting the game server...');
    console.log('\nThe game will be available at:');
    console.log('   http://localhost:3000  (or another port if 3000 is in use)');
    console.log('\nWait for the "Server running on http://localhost:XXXX" message.');
    console.log('Press Ctrl+C to stop the server when you\'re done.');
    console.log('\n======================================\n');
    
    // Start the server as a child process
    const serverProcess = spawn('node', ['server.js'], {
      stdio: 'inherit',
      shell: true
    });
    
    // Handle server process events
    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
    });
    
    serverProcess.on('close', (code) => {
      if (code !== 0) {
        console.log(`Server process exited with code ${code}`);
      }
      console.log('Server has been shut down.');
    });
    
  } catch (err) {
    console.error('Error in server launcher:', err);
  }
}

// Start the server
startServer(); 