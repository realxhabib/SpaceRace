// test_multiplayer.js - Test multiplayer functionality
import { NetworkManager } from './network.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TestGameState {
    constructor() {
        this.players = {};
        this.powerups = [];
        this.asteroids = [];
        this.isRunning = false;
        this.winner = null;
    }
}

// Create test instances
const gameState1 = new TestGameState();
const gameState2 = new TestGameState();

const network1 = new NetworkManager(gameState1);
const network2 = new NetworkManager(gameState2);

// Test event handlers
function setupNetworkHandlers(network, playerNum) {
    network.on('connected', (playerId) => {
        console.log(`Player ${playerNum} connected with ID:`, playerId);
    });

    network.on('playersUpdated', (data) => {
        console.log(`Player ${playerNum} received players update:`, data);
    });

    network.on('gameStarted', (state) => {
        console.log(`Player ${playerNum} game started:`, state);
    });

    network.on('gameStateUpdated', (state) => {
        console.log(`Player ${playerNum} state update:`, state);
    });

    network.on('powerupEffect', (data) => {
        console.log(`Player ${playerNum} powerup effect:`, data);
    });

    network.on('gameOver', (data) => {
        console.log(`Player ${playerNum} game over:`, data);
    });
}

// Setup handlers
setupNetworkHandlers(network1, 1);
setupNetworkHandlers(network2, 2);

// Start test sequence
async function runTest() {
    console.log('Starting multiplayer test...');

    // Connect both players
    network1.connect();
    network2.connect();

    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Join lobby
    network1.joinLobby('Player 1');
    network2.joinLobby('Player 2');

    // Wait for lobby join
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Set players ready
    network1.setReady();
    network2.setReady();

    // Wait for ready state
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start game
    network1.startGame();

    // Simulate game updates
    let updateCount = 0;
    const updateInterval = setInterval(() => {
        if (updateCount >= 10) {
            clearInterval(updateInterval);
            // Test powerup
            network1.usePowerup(network2.playerId, 'speed');
            // End game
            network1.reportElimination();
            return;
        }

        network1.updatePlayer(
            { x: Math.random() * 10, y: 0, z: Math.random() * 10 },
            { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
            100
        );

        network2.updatePlayer(
            { x: Math.random() * -10, y: 0, z: Math.random() * -10 },
            { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
            100
        );

        updateCount++;
    }, 1000);
}

// Run the test
runTest().catch(console.error);

// Handle cleanup
process.on('SIGINT', () => {
    network1.disconnect();
    network2.disconnect();
    process.exit();
}); 