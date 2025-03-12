// server.js - Socket.io server for multiplayer functionality
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const compression = require('compression');
const net = require('net');
const fs = require('fs');

const app = express();

// Use compression middleware to reduce data transfer
app.use(compression());

// Serve static files with cache headers for better performance
app.use(express.static(path.join(__dirname, './'), {
  maxAge: '1h', // Cache static assets for 1 hour
  setHeaders: (res, path) => {
    if (path.endsWith('.glb') || path.endsWith('.gltf')) {
      // Set longer cache for 3D models
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    }
  }
}));

// Add a config endpoint to provide server configuration to the client
app.get('/config', (req, res) => {
  // Get the actual port the server is running on
  const port = req.socket.localPort;
  res.json({
    port: port
  });
});

// Create a favicon.ico file to prevent 404 errors
const createFaviconIfNeeded = () => {
  const faviconPath = path.join(__dirname, 'favicon.ico');
  if (!fs.existsSync(faviconPath)) {
    // Create a very simple 16x16 favicon (transparent)
    const buffer = Buffer.alloc(16 * 16 * 4, 0);
    
    // Write the buffer to a file
    fs.writeFileSync(faviconPath, buffer);
    console.log('Created simple favicon.ico file');
  }
};

// Create favicon to prevent 404 errors
createFaviconIfNeeded();

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Game state
let players = {};
let readyPlayers = 0;
let gameStarted = false;

// WebSocket server logic
wss.on('connection', (ws) => {
  console.log('A client connected');
  let playerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      if (data.type === 'join') {
        playerId = Date.now().toString();
        players[playerId] = {
          id: playerId,
          name: data.name,
          ready: false,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          health: 100,
          score: 0
        };
        
        // Send player ID back to the client
        const joinedMessage = {
          type: 'joined',
          id: playerId,
          players: players
        };
        console.log('Sending joined message:', joinedMessage);
        ws.send(JSON.stringify(joinedMessage));
        
        // Broadcast new player to all connected clients
        broadcastGameState();
      }
      
      if (data.type === 'ready' && playerId) {
        console.log(`Player ${playerId} is ready`);
        players[playerId].ready = true;
        readyPlayers++;
        
        // Start game if all players are ready
        if (readyPlayers >= 2 && !gameStarted) {
          console.log('All players ready, starting game');
          gameStarted = true;
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'gameStart'
              }));
            }
          });
        }
        
        broadcastGameState();
      }
      
      if (data.type === 'update' && playerId) {
        if (players[playerId]) {
          players[playerId].position = data.position;
          players[playerId].rotation = data.rotation;
          players[playerId].health = data.health;
          players[playerId].score = data.score;
          
          // Check if player lost
          if (data.health <= 0 && players[playerId].health > 0) {
            ws.send(JSON.stringify({
              type: 'gameLost'
            }));
          }
          
          broadcastGameState();
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (playerId && players[playerId]) {
      if (players[playerId].ready) {
        readyPlayers--;
      }
      delete players[playerId];
      
      // Reset game if not enough players
      if (readyPlayers < 2 && gameStarted) {
        gameStarted = false;
      }
      
      broadcastGameState();
    }
  });
});

// Broadcast game state to all clients
function broadcastGameState() {
  const gameState = {
    type: 'gameState',
    players: players,
    gameStarted: gameStarted
  };
  
  console.log('Broadcasting game state:', {
    playerCount: Object.keys(players).length,
    readyCount: readyPlayers,
    gameStarted: gameStarted
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(gameState));
      } catch (error) {
        console.error('Error sending game state to client:', error);
      }
    }
  });
}

// Check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port);
  });
}

// Start server on an available port
async function startServer(initialPort = 3000) {
  let port = initialPort;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const inUse = await isPortInUse(port);
    
    if (!inUse) {
      server.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
      });
      return;
    }
    
    console.log(`Port ${port} is already in use, trying port ${port + 1}`);
    port++;
    attempts++;
  }
  
  console.error(`Could not find an available port after ${maxAttempts} attempts.`);
}

// Start the server on an available port
startServer();
