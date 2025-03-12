// main.js - Entry point for the game
import * as THREE from 'three';
import { io } from 'socket.io-client';
import { setupScene } from './scene.js';
import { createSpaceship } from './spaceship.js';
import { setupControls } from './controls.js';
import { AsteroidSystem } from './asteroids.js';
import { PowerupSystem } from './powerups.js';
import { PlanetSystem } from './planets.js';
import { CollisionSystem } from './collision.js';
import { UIManager } from './ui.js';
import { NetworkManager } from './network.js';
import { enhanceSpaceshipWithMarioKartPowerups } from './mario-kart-powerups.js';

// Game state
const gameState = {
  isRunning: false,
  players: {},
  localPlayer: null,
  asteroids: [],
  powerups: [],
  planets: [],
  playerName: '',
  playersRemaining: 0
};

// DOM elements
const loadingScreen = document.getElementById('loading-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameUI = document.getElementById('game-ui');
const playerNameInput = document.getElementById('player-name');
const joinGameBtn = document.getElementById('join-game-btn');
const startGameBtn = document.getElementById('start-game-btn');
const playersList = document.getElementById('players-list');
const playersRemainingDisplay = document.getElementById('players-remaining');
const gameOverScreen = document.getElementById('game-over');
const gameOverText = document.getElementById('game-over-text');
const returnLobbyBtn = document.getElementById('return-lobby-btn');

// Game systems
let scene, camera, renderer;
let spaceship;
let controls;
let asteroidSystem;
let powerupSystem;
let planetSystem;
let collisionSystem;
let uiManager;
let networkManager;
let clock;

// Initialize the game
async function init() {
  // Setup Three.js scene
  const sceneSetup = setupScene();
  scene = sceneSetup.scene;
  camera = sceneSetup.camera;
  renderer = sceneSetup.renderer;
  clock = new THREE.Clock();
  
  // Initialize game systems
  networkManager = new NetworkManager(gameState);
  spaceship = await createSpaceship(scene, camera);
  
  // Enhance spaceship with Mario Kart powerups
  spaceship = enhanceSpaceshipWithMarioKartPowerups(spaceship, gameState);
  
  controls = setupControls(camera, spaceship.mesh);
  asteroidSystem = new AsteroidSystem(scene);
  powerupSystem = new PowerupSystem(scene);
  planetSystem = new PlanetSystem(scene);
  collisionSystem = new CollisionSystem(gameState);
  uiManager = new UIManager(gameState);
  
  // Setup event listeners
  setupEventListeners();
  
  // Show lobby screen
  loadingScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  
  // Start animation loop
  animate();
}

// Setup event listeners
function setupEventListeners() {
  // Join game button
  joinGameBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
      gameState.playerName = name;
      networkManager.joinLobby(name);
    }
  });
  
  // Start game button
  startGameBtn.addEventListener('click', () => {
    networkManager.startGame();
  });
  
  // Return to lobby button
  returnLobbyBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    gameUI.classList.add('hidden');
    resetGame();
  });
  
  // Network events
  networkManager.on('playerJoined', updatePlayersList);
  networkManager.on('playerLeft', updatePlayersList);
  networkManager.on('gameStarted', startGame);
  networkManager.on('gameOver', endGame);
}

// Update the players list in the lobby
function updatePlayersList(players) {
  playersList.innerHTML = '';
  Object.values(players).forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name;
    playersList.appendChild(li);
  });
  
  // Enable start button if there are at least 2 players
  startGameBtn.disabled = Object.keys(players).length < 2;
}

// Start the game
function startGame() {
  lobbyScreen.classList.add('hidden');
  gameUI.classList.remove('hidden');
  gameState.isRunning = true;
  
  // Initialize game elements
  asteroidSystem.init();
  powerupSystem.init();
  planetSystem.init();
  
  // Reset player position
  spaceship.reset();
  
  // Force pointer lock for first-person controls
  document.body.requestPointerLock();
}

// End the game
function endGame(result) {
  gameState.isRunning = false;
  gameOverText.textContent = result.winner === gameState.playerName 
    ? 'You Won!' 
    : `Game Over! ${result.winner} won!`;
  gameOverScreen.classList.remove('hidden');
}

// Reset the game state
function resetGame() {
  asteroidSystem.reset();
  powerupSystem.reset();
  planetSystem.reset();
  spaceship.reset();
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  if (gameState.isRunning) {
    // Update game systems
    controls.update(delta);
    asteroidSystem.update(delta);
    powerupSystem.update(delta);
    planetSystem.update(delta);
    
    // Check collisions
    collisionSystem.checkCollisions(
      spaceship, 
      asteroidSystem.asteroids, 
      powerupSystem.powerups
    );
    
    // Update network
    networkManager.updatePlayerPosition(spaceship.mesh.position, spaceship.mesh.rotation);
    
    // Update UI
    uiManager.update();
    
    // Update players remaining display
    playersRemainingDisplay.textContent = `Players: ${gameState.playersRemaining}`;
  }
  
  // Render scene
  renderer.render(scene, camera);
}

// Start loading the game
window.addEventListener('load', init);
