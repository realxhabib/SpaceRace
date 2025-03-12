// network.js - Handle multiplayer networking with WebSockets
// Removed socket.io-client import as we're using native WebSockets

export class NetworkManager {
  constructor(gameState, port = 3000) {
    this.gameState = gameState;
    this.eventListeners = {};
    this.playerId = null;
    this.port = port;
  }
  
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsUrl = `${protocol}//${host}:${this.port}`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connection established');
      
      // Enable buttons once connected
      const joinBtn = document.getElementById('join-btn');
      const singlePlayerBtn = document.getElementById('single-player-btn');
      
      if (joinBtn) joinBtn.disabled = false;
      if (singlePlayerBtn) singlePlayerBtn.disabled = false;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        this.playerId = data.playerId;
        this.triggerEvent('connected', this.playerId);
        break;
        
      case 'joined':
        this.playerId = data.id;
        this.gameState.players = data.players;
        this.triggerEvent('connected', this.playerId);
        this.triggerEvent('playersUpdated', { players: data.players });
        console.log('Joined game with ID:', this.playerId);
        break;
        
      case 'playersUpdated':
        this.gameState.players = data.players;
        // Check if autostart should happen (2+ players all ready)
        const playerArray = Object.values(data.players);
        const readyCount = playerArray.filter(player => player.ready).length;
        console.log(`Players updated: ${playerArray.length} players, ${readyCount} ready`);
        
        if (playerArray.length >= 2 && readyCount === playerArray.length) {
          console.log("All players ready, auto-starting game!");
          // Only let the first player (host) send the start command
          const playerIds = Object.keys(data.players).sort();
          if (playerIds[0] === this.playerId) {
            this.startGame();
          }
        }
        
        this.triggerEvent('playersUpdated', data);
        break;
        
      case 'gameStarted':
        this.gameState.isRunning = true;
        Object.assign(this.gameState, data.gameState);
        this.triggerEvent('gameStarted', this.gameState);
        break;
        
      case 'gameStateUpdated':
        // Important: preserve local player's position to avoid jitter
        const localPlayerData = this.gameState.players[this.playerId];
        
        // Update game state with server data
        Object.assign(this.gameState, data);
        
        // If local player exists, restore position data that was overwritten
        if (localPlayerData && this.gameState.players[this.playerId]) {
          // Keep the server's health value and other critical data
          const serverHealth = this.gameState.players[this.playerId].health;
          
          // But use local position data to avoid jitter
          this.gameState.players[this.playerId].position = localPlayerData.position;
          this.gameState.players[this.playerId].rotation = localPlayerData.rotation;
          
          // Make sure health is synced from server
          if (serverHealth !== undefined) {
            this.gameState.players[this.playerId].health = serverHealth;
          }
        }
        
        this.triggerEvent('gameStateUpdated', this.gameState);
        break;
        
      case 'countdown':
        this.triggerEvent('countdown', data);
        break;
        
      case 'gameOver':
        this.gameState.isRunning = false;
        this.gameState.winner = data.winner;
        this.triggerEvent('gameOver', data);
        break;
    }
  }
  
  joinLobby(name) {
    this.sendMessage({
      type: 'join',
      name
    });
  }
  
  setReady() {
    this.sendMessage({
      type: 'ready'
    });
  }
  
  startGame() {
    this.sendMessage({
      type: 'startGame'
    });
  }
  
  updatePlayer(position, rotation, health) {
    this.sendMessage({
      type: 'updatePlayer',
      position,
      rotation,
      health
    });
  }
  
  shoot(position, direction) {
    this.sendMessage({
      type: 'shoot',
      position,
      direction
    });
  }
  
  gameOver() {
    this.sendMessage({
      type: 'gameOver'
    });
  }
  
  enemyDestroyed(enemyId) {
    this.sendMessage({
      type: 'enemyDestroyed',
      enemyId
    });
  }
  
  // Add single player support
  startSinglePlayerMode(playerName) {
    // Generate a local player ID
    this.playerId = 'solo_' + Date.now();
    
    console.log(`Starting single player mode with ID: ${this.playerId}`);
    
    // Set up initial game state
    this.gameState.players = {
      [this.playerId]: {
        id: this.playerId,
        name: playerName,
        ready: true,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        health: 100,
        score: 0
      }
    };
    
    // Set single player mode flag
    this.singlePlayerMode = true;
    
    // Trigger connected event
    this.triggerEvent('connected', this.playerId);
    
    // Trigger player update event
    this.triggerEvent('playersUpdated', { players: this.gameState.players });
    
    return this.playerId;
  }
  
  sendMessage(data) {
    // If in single player mode, handle messages locally
    if (this.singlePlayerMode) {
      console.log(`[SINGLE PLAYER] Local message: ${data.type}`, data);
      
      // Handle local messages for single player
      switch (data.type) {
        case 'updatePlayer':
          if (this.gameState.players[this.playerId]) {
            this.gameState.players[this.playerId].position = data.position;
            this.gameState.players[this.playerId].rotation = data.rotation;
            this.gameState.players[this.playerId].health = data.health;
          }
          break;
          
        case 'shoot':
          // Handle shooting locally (no server needed)
          console.log('[SINGLE PLAYER] Player shot projectile');
          break;
          
        case 'gameOver':
          this.gameState.isRunning = false;
          this.triggerEvent('gameOver', { winner: null });
          break;
      }
      
      return;
    }
    
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(`Sending message: ${data.type}`, data);
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send message, WebSocket not connected', data);
    }
  }
  
  on(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    this.eventListeners[eventType].push(callback);
    console.log(`Added listener for event: ${eventType}`);
  }
  
  triggerEvent(eventType, data) {
    console.log(`Triggering event: ${eventType}`, data);
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach(callback => callback(data));
    } else {
      console.warn(`No listeners for event: ${eventType}`);
    }
  }
}

