// client.js - Game client implementation
import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';
import { NetworkManager } from './network.js';
import { createBasicAsteroid, createAsteroidGroup } from './models/basicAsteroid.js';

class GameClient {
    constructor() {
        this.gameState = {
            players: {},
            powerups: [],
            asteroids: [],
            enemies: [],
            projectiles: [],
            isRunning: false,
            winner: null
        };
        this.localPlayer = {
            health: 100,  // Initialize health here
            distanceTraveled: 0
        };
        this.movementBoundaries = {
            minX: -100,
            maxX: 100,
            minY: -60,
            maxY: 60,
            minZ: -500, // Only if you want to limit backward movement
            maxZ: 500  // Only if you want to limit forward movement
        };
        this.playerMeshes = new Map();
        this.asteroidSystem = null;
        this.models = {
            ships: [],
            asteroids: [], // Will hold all asteroid variants from single GLB
            stations: [],
            debris: [],
            enemies: []
        };
        this.projectiles = new Set();
        this.lastShot = 0;
        this.SHOT_COOLDOWN = 250;
        
        // Add camera settings
        this.cameraSettings = {
            minZoom: 8,
            maxZoom: 25,
            currentZoom: 15,
            zoomSpeed: 1,
            height: 5,
            lookAheadDistance: 10
        };
        
        // Add movement control state with reduced speeds
        this.controls = {
            up: false,
            down: false,
            left: false,
            right: false,
            boost: false,
            baseSpeed: 0.4,
            boostMultiplier: 1.8,
            verticalSpeed: 0.5,
            horizontalSpeed: 0.5,
            currentSpeed: 0.4,
            // Mouse control properties - disabled as requested
            mouseEnabled: false, // Changed from true to false
            mousePosition: new THREE.Vector2(0, 0),
            targetDirection: new THREE.Vector2(0, 0),
            currentDirection: new THREE.Vector2(0, 0),
            smoothFactor: 0.1,
            deadZone: 0.05
        };
        
        // Maximum number of active asteroids
        this.maxActiveAsteroids = 150; // Increased from 100 to 150 for more asteroids
        
        // Initialize the game
        this.init();

        // Add speed tracker display
        this.speedTracker = document.createElement('div');
        this.speedTracker.style.position = 'absolute';
        this.speedTracker.style.top = '10px';
        this.speedTracker.style.right = '10px';
        this.speedTracker.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.speedTracker.style.color = 'white';
        this.speedTracker.style.padding = '10px';
        this.speedTracker.style.borderRadius = '5px';
        this.speedTracker.style.fontFamily = 'Arial, sans-serif';
        this.speedTracker.style.zIndex = '1000';
        document.body.appendChild(this.speedTracker);
        
        // Set the original base speed values for reference
        this.originalBaseSpeed = 0.4;
        this.originalBoostMultiplier = 1.8;
        
        // Initialize current speed level
        this.currentSpeedLevel = 0;
        
        // Initialize distance traveled
        this.distanceTraveled = 0;
        
        // Initialize variables for time-based distance tracking
        this.gameStartTime = 0;
        this.lastDistanceUpdateTime = 0;
        
        // Tracking for speed increases
        this.nextSpeedIncreaseAt = 500; // First speed increase at 500 units
    }

    async init() {
        try {
            console.log('Starting game initialization...');
            
            // IMMEDIATELY enable buttons regardless of connectivity
            // This needs to happen before any async operations
            const joinBtn = document.getElementById('join-btn');
            const readyBtn = document.getElementById('ready-btn');
            const singlePlayerBtn = document.getElementById('single-player-btn');
            
            if (joinBtn) joinBtn.disabled = false;
            if (singlePlayerBtn) singlePlayerBtn.disabled = false; 
            
            // Set status text
            document.getElementById('game-status').textContent = 'Single Player Ready';
            
            // Setup Three.js first (without asteroids)
            this.setupThreeJS();
            console.log('Three.js setup complete');
            
            // Create health display immediately
            this.createHealthDisplay();
            
            // Load 3D models
            await this.loadModels();
            console.log('Models loaded');
            
            // Create basic models (will use loaded models if available)
            this.createBasicModels();
            
            // Set up things that don't require the server
            this.setupUI();
            console.log('UI setup complete');
            
            // Start animation loop
            this.animate();
            
            // Set up LOD for asteroids
            this.setupLOD();
            
            // Initialize network tracking variables
            this.lastSentPosition = null;
            this.lastSentRotation = null;
            this.lastSentHealth = null;
            this.lastSentScore = null;
            
            // Try to connect to server for multiplayer, but don't make it required
            try {
                // Get server configuration
                let port = 3000; // Default port
                console.log('Fetching server config...');
                const response = await fetch('/config');
                const config = await response.json();
                port = config.port;
                console.log('Server config loaded, port:', port);
                
                // Setup networking with the correct port
                this.setupNetworking(port);
                console.log('Network setup complete');
            } catch (err) {
                console.warn('Server not available, single player mode only:', err);
                document.getElementById('game-status').textContent = 'Server Offline - Single Player Only';
                document.getElementById('ready-btn').disabled = true;
            }
            
            console.log('Game initialization complete');
        } catch (err) {
            console.error('Failed to initialize game:', err);
            document.getElementById('game-status').textContent = 'Error! Try Single Player mode';
            
            // Display error message on screen
            const errorMsg = document.createElement('div');
            errorMsg.style.position = 'fixed';
            errorMsg.style.top = '50%';
            errorMsg.style.left = '50%';
            errorMsg.style.transform = 'translate(-50%, -50%)';
            errorMsg.style.padding = '20px';
            errorMsg.style.backgroundColor = 'rgba(0,0,0,0.8)';
            errorMsg.style.color = '#ff0000';
            errorMsg.style.border = '1px solid red';
            errorMsg.style.borderRadius = '5px';
            errorMsg.style.zIndex = '1000';
            errorMsg.innerHTML = `<h3>Game Error</h3><p>${err.message}</p><p>You can still try Single Player mode!</p>`;
            document.body.appendChild(errorMsg);
            
            // Force-enable buttons as a last resort
            this.enableButtons();
        }
    }
    
    // Helper method to ensure buttons are enabled
    enableButtons() {
        console.log('Forcing buttons to be enabled');
        const joinBtn = document.getElementById('join-btn');
        const singlePlayerBtn = document.getElementById('single-player-btn');
        
        if (joinBtn) joinBtn.disabled = false;
        if (singlePlayerBtn) singlePlayerBtn.disabled = false;
        
        // Update status if still showing connecting message
        const gameStatus = document.getElementById('game-status');
        if (gameStatus && gameStatus.textContent === 'Connecting to server...') {
            gameStatus.textContent = 'Ready to play!';
        }
    }

    createBasicModels() {
        // Skip creating basic models if we have loaded models
        if (this.models.ships.length > 0) {
            console.log('Using loaded ship models instead of basic models');
            return;
        }

        console.warn('Falling back to basic models');
        // Create basic ship model
        const basicShip = this.createBasicShipMesh();
        this.models.ships = [basicShip];

        // Create basic station model
        const stationGeometry = new THREE.SphereGeometry(5, 16, 16);
        const stationMaterial = new THREE.MeshPhongMaterial({
            color: 0x666666,
            emissive: 0x444444,
            shininess: 30
        });
        const stationMesh = new THREE.Mesh(stationGeometry, stationMaterial);
        this.models.stations = [stationMesh];

        // Create basic asteroid models
        const asteroidGeometries = [
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.IcosahedronGeometry(1, 1),
            new THREE.DodecahedronGeometry(1, 0)
        ];
        this.models.asteroids = asteroidGeometries.map(geometry => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                roughness: 0.9,
                metalness: 0.1
            });
            return new THREE.Mesh(geometry, material);
        });

        // Create basic enemy model
        const enemyShip = this.createBasicEnemyMesh();
        this.models.enemies = [enemyShip];

        // Add stations to scene
        const positions = [
            { x: 100, y: 0, z: 100 },
            { x: -100, y: 0, z: -100 }
        ];
        
        positions.forEach((pos, index) => {
            const station = this.models.stations[0].clone();
            station.position.set(pos.x, pos.y, pos.z);
            station.rotation.y = Math.random() * Math.PI * 2;
            this.scene.add(station);
        });
    }

    createBasicEnemyMesh() {
        const enemyGroup = new THREE.Group();

        // Enemy body
        const bodyGeometry = new THREE.ConeGeometry(1, 2, 6);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            shininess: 100,
            specular: 0x111111
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        enemyGroup.add(body);

        // Enemy wings
        const wingGeometry = new THREE.BoxGeometry(3, 0.2, 1);
        const wingMaterial = new THREE.MeshPhongMaterial({
            color: 0xcc0000,
            shininess: 100,
            specular: 0x111111
        });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-1, 0, -0.5);
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(1, 0, -0.5);
        enemyGroup.add(leftWing);
        enemyGroup.add(rightWing);

        // Enemy glow
        const engineGlow = new THREE.PointLight(0xff0000, 1, 5);
        engineGlow.position.set(0, 0, -1);
        enemyGroup.add(engineGlow);

        return enemyGroup;
    }

    initAsteroidSystem() {
        console.log('Initializing asteroid system with optimized resource pooling...');
        
        // Create pools for asteroid objects and materials
        this.asteroidPool = [];
        this.inactiveAsteroids = [];  // Pool of inactive/reusable asteroids
        this.sharedMaterials = [];    // Shared materials to reduce GPU state changes
        
        // Initialize difficulty settings
        this.difficultyLevel = 1;
        this.difficultyUpdateInterval = 1000; // Check every 1 second
        this.lastDifficultyUpdate = Date.now();
        this.lastCleanupTime = Date.now();
        this.cleanupInterval = 5000; // Clean up every 5 seconds
        
        // SIGNIFICANTLY INCREASED pool size to handle high-speed gameplay
        const poolSize = 250; // Increased from 120 to handle up to 90 active + buffer
        
        // Track active asteroid positions to ensure minimum spacing
        this.minimumAsteroidSpacing = 60; // Minimum units between asteroids
        
        // Create shared materials (only create a few variations to save memory)
        const materialColors = [0x888888, 0x777777, 0x666666, 0x555555];
        
        for (let i = 0; i < materialColors.length; i++) {
            // Create standard material
            this.sharedMaterials.push(
                new THREE.MeshStandardMaterial({
                    color: materialColors[i],
                    roughness: 0.7 + (Math.random() * 0.3),
                    metalness: 0.1 + (Math.random() * 0.3)
                })
            );
            
            // Create wireframe material
            this.sharedMaterials.push(
                new THREE.MeshBasicMaterial({
                    color: materialColors[i],
                    wireframe: true
                })
            );
        }
        
        // Initialize asteroid pool
        if (!this.models.asteroids || this.models.asteroids.length === 0) {
            console.warn('No asteroid models available, creating basic ones');
            // Create basic asteroid geometries if no models are available
            this.asteroidGeometries = [
                new THREE.IcosahedronGeometry(1, 0), // Simple
                new THREE.IcosahedronGeometry(1, 1), // Medium
                new THREE.SphereGeometry(1, 6, 6)    // Fallback
            ];
            
            // Fill pool with basic asteroids
            for (let i = 0; i < poolSize; i++) {
                const geoIndex = Math.floor(Math.random() * this.asteroidGeometries.length);
                const matIndex = Math.floor(Math.random() * this.sharedMaterials.length);
                
                const mesh = new THREE.Mesh(
                    this.asteroidGeometries[geoIndex],
                    this.sharedMaterials[matIndex]
                );
                
            const baseScale = 0.015 + Math.random() * 0.025;
                const sizeMultiplier = 1.1 + Math.random() * 0.1;
            const scale = baseScale * sizeMultiplier;
            
                mesh.scale.set(scale, scale, scale);
                mesh.visible = false;
                this.scene.add(mesh);
                
                const asteroid = {
                    mesh: mesh,
                    active: false,
                    velocity: new THREE.Vector3(),
                    rotationSpeed: new THREE.Vector3(
                        Math.random() * 0.005 - 0.0025,
                        Math.random() * 0.005 - 0.0025,
                        Math.random() * 0.005 - 0.0025
                    ),
                    size: scale * 10
                };
                
                this.inactiveAsteroids.push(asteroid);
            }
        } else {
            // Use the provided models for the pool
            const baseModels = this.models.asteroids;
            
            for (let i = 0; i < poolSize; i++) {
                // Cycle through available models
                const modelIndex = i % baseModels.length;
                const asteroidModel = baseModels[modelIndex].clone();
                
                // Randomize scale while keeping them relatively small
                const baseScale = 0.015 + Math.random() * 0.025;
                const sizeMultiplier = 1.1 + Math.random() * 0.1;
                const scale = baseScale * sizeMultiplier;
                
                asteroidModel.scale.set(scale, scale, scale);
            asteroidModel.visible = false;
            this.scene.add(asteroidModel);
            
                const asteroid = {
                mesh: asteroidModel,
                active: false,
                velocity: new THREE.Vector3(),
                rotationSpeed: new THREE.Vector3(
                    Math.random() * 0.005 - 0.0025,
                    Math.random() * 0.005 - 0.0025,
                        Math.random() * 0.005 - 0.0025
                    ),
                    size: scale * 10,
                    originalModel: true // Flag to indicate this is a cloned original model
                };
                
                this.inactiveAsteroids.push(asteroid);
            }
        }
        
        // Store initial pool size for tracking purposes
        this.initialPoolSize = poolSize;
        console.log(`Created asteroid pool with ${this.inactiveAsteroids.length} reusable asteroids`);
        this.asteroids = []; // Active asteroids
    }

    // Improved method to get asteroid from pool with auto-expansion
    getAsteroidFromPool() {
        // Track pool usage statistics if enabled
        if (this.trackPoolUsage && !this.poolStats) {
            this.poolStats = {
                maxActive: 0,
                expansions: 0,
                totalCreated: this.initialPoolSize || 0
            };
        }
        
        // If we have inactive asteroids, reuse one
        if (this.inactiveAsteroids.length > 0) {
            const asteroid = this.inactiveAsteroids.pop();
            asteroid.active = true;
            asteroid.mesh.visible = true;
            this.asteroids.push(asteroid);
            
            // Update stats
            if (this.trackPoolUsage && this.asteroids.length > this.poolStats.maxActive) {
                this.poolStats.maxActive = this.asteroids.length;
            }
            
            return asteroid;
        }
        
        // If no inactive asteroids are available, check if we have room to expand the pool
        const totalAsteroids = this.asteroids.length + this.inactiveAsteroids.length;
        const maxPoolSize = 350; // Set a hard limit to prevent memory issues
        
        if (totalAsteroids < maxPoolSize) {
            // Create additional asteroids (expand the pool by 20% of current size)
            const expansionSize = Math.max(10, Math.floor(totalAsteroids * 0.2));
            console.log(`Expanding asteroid pool by ${expansionSize} objects (current: ${totalAsteroids})`);
            
            // Update stats
            if (this.trackPoolUsage) {
                this.poolStats.expansions++;
                this.poolStats.totalCreated += expansionSize;
            }
            
            // Create new asteroids to add to the pool
            for (let i = 0; i < expansionSize; i++) {
                let newAsteroid;
                
                // Use similar creation logic as in initAsteroidSystem
                if (!this.models.asteroids || this.models.asteroids.length === 0) {
                    // Use basic geometry if no models available
                    if (!this.asteroidGeometries) {
                        this.asteroidGeometries = [
                            new THREE.IcosahedronGeometry(1, 0),
                            new THREE.IcosahedronGeometry(1, 1),
                            new THREE.SphereGeometry(1, 6, 6)
                        ];
                    }
                    
                    const geoIndex = Math.floor(Math.random() * this.asteroidGeometries.length);
                    const matIndex = Math.floor(Math.random() * this.sharedMaterials.length);
                    
                    const mesh = new THREE.Mesh(
                        this.asteroidGeometries[geoIndex],
                        this.sharedMaterials[matIndex]
                    );
                    
                    const baseScale = 0.015 + Math.random() * 0.025;
                    const sizeMultiplier = 1.1 + Math.random() * 0.1;
                    const scale = baseScale * sizeMultiplier;
                    
                    mesh.scale.set(scale, scale, scale);
                    mesh.visible = false;
                    this.scene.add(mesh);
                    
                    newAsteroid = {
                        mesh: mesh,
                        active: false,
                        velocity: new THREE.Vector3(),
                        rotationSpeed: new THREE.Vector3(
                            Math.random() * 0.005 - 0.0025,
                            Math.random() * 0.005 - 0.0025,
                            Math.random() * 0.005 - 0.0025
                        ),
                        size: scale * 10
                    };
                } else {
                    // Use model-based asteroids
                    const modelIndex = Math.floor(Math.random() * this.models.asteroids.length);
                    const asteroidModel = this.models.asteroids[modelIndex].clone();
                    
                    const baseScale = 0.015 + Math.random() * 0.025;
                    const sizeMultiplier = 1.1 + Math.random() * 0.1;
                    const scale = baseScale * sizeMultiplier;
                    
                    asteroidModel.scale.set(scale, scale, scale);
                    asteroidModel.visible = false;
                    this.scene.add(asteroidModel);
                    
                    newAsteroid = {
                        mesh: asteroidModel,
                        active: false,
                        velocity: new THREE.Vector3(),
                        rotationSpeed: new THREE.Vector3(
                            Math.random() * 0.005 - 0.0025,
                            Math.random() * 0.005 - 0.0025,
                            Math.random() * 0.005 - 0.0025
                        ),
                        size: scale * 10,
                        originalModel: true
                    };
                }
                
                // Use the newly created asteroid
                if (i === 0) {
                    // Use the first new asteroid immediately
                    newAsteroid.active = true;
                    newAsteroid.mesh.visible = true;
                    newAsteroid.creationTime = Date.now();
                    this.asteroids.push(newAsteroid);
                } else {
                    // Add the rest to the inactive pool
                    this.inactiveAsteroids.push(newAsteroid);
                }
            }
            
            // Return the first asteroid we created
            return this.asteroids[this.asteroids.length - 1];
        }
        
        // If we reached the hard limit, recycle the oldest active asteroid
        if (this.asteroids.length > 0) {
            console.warn(`Maximum asteroid pool size reached (${maxPoolSize}). Recycling oldest active asteroid.`);
            
            // Sort by creation time if available, otherwise just take the first one
            if (this.asteroids[0].creationTime) {
                this.asteroids.sort((a, b) => a.creationTime - b.creationTime);
            }
            
            const asteroid = this.asteroids.shift(); // Remove oldest from active list
            
            // Reset the asteroid for reuse
            asteroid.creationTime = Date.now();
            asteroid.active = true;
            
            // Add back to active list
            this.asteroids.push(asteroid);
            return asteroid;
        }
        
        // This should never happen with pool expansion, but just in case
        console.error("Critical asteroid pool failure - unable to provide an asteroid");
        return null;
    }

    // Return asteroid to pool for reuse
    returnAsteroidToPool(asteroid) {
        if (!asteroid) return;
        
        // Remove from active asteroids if present
        const index = this.asteroids.indexOf(asteroid);
        if (index !== -1) {
            this.asteroids.splice(index, 1);
        }
        
        // Reset asteroid state
        asteroid.active = false;
        asteroid.mesh.visible = false;
        
        // Add to inactive pool for reuse
        this.inactiveAsteroids.push(asteroid);
    }

    // Fix asteroid spawning issues - completely revamped to ensure visibility
    spawnAsteroid(randomMode = false) {
        // Check if we're in a game state where we should spawn asteroids
        if (!this.gameState || !this.gameState.isRunning) return;
        
        try {
            // Get player position for reference (works in both single player and multiplayer)
            const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
            const playerMesh = this.playerMeshes.get(playerId);
            
            // Can't spawn without player reference
            if (!playerMesh) {
                console.error("Cannot spawn asteroid: Player mesh not found");
                return null;
            }
            
            // Initialize pool systems if needed
            if (!this.inactiveAsteroids) {
                console.log("Initializing asteroid system before spawning");
                this.initAsteroidSystem();
            }
            
            // Debug asteroids array state
            if (!this.asteroids) {
                console.error("Asteroids array is null - creating new array");
                this.asteroids = [];
            }
            
            // Force creating a new asteroid immediately if the pool is completely empty
            if (this.inactiveAsteroids.length === 0 && this.asteroids.length === 0) {
                console.log("No asteroids available - forcing system initialization");
                this.initAsteroidSystem();
            }
            
            // Get asteroid from pool 
            const asteroid = this.getAsteroidFromPool();
            if (!asteroid) {
                console.error("Failed to get asteroid from pool");
                return null;
            }
            
            // Force-create a new mesh if somehow the asteroid has no mesh
            if (!asteroid.mesh) {
                console.error("Asteroid has no mesh - creating an emergency mesh");
                const geometry = new THREE.IcosahedronGeometry(1, 0);
                const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
                asteroid.mesh = new THREE.Mesh(geometry, material);
                this.scene.add(asteroid.mesh);
            }
            
            // Enable asteroid and make it visible
            asteroid.active = true;
            asteroid.mesh.visible = true;
            
            // Get current player speed (if available)
            let playerSpeed = 1.0;
            if (this.controls && this.controls.baseSpeed) {
                playerSpeed = this.controls.baseSpeed;
            }
            
            // IMPORTANT: Get accurate player forward direction
            const playerForward = new THREE.Vector3(0, 0, -1);
            playerForward.applyQuaternion(playerMesh.quaternion);
            
            // ENHANCED: Spawn at greater distances scaled with player speed
            const minSpawnDistance = 250; // Increased from 150 to 250
            const speedScaledDistance = Math.min(350, 100 + (playerSpeed * 50)); // Higher cap for greater visibility
            
            // Add more randomness to spawn distance for depth perception
            const randomDistanceOffset = Math.random() * 300; // Up to 300 units of random distance
            const spawnDistance = minSpawnDistance + speedScaledDistance + randomDistanceOffset;
            
            // Use player position as the reference point
            const spawnPosition = playerMesh.position.clone();
            
            // Determine if asteroid should directly target the player with varying accuracy
            // More accurate targeting at higher difficulty or for special "hunter" asteroids
            const directTargetingChance = Math.min(0.3, 0.1 + (this.difficultyLevel || 1) * 0.02);
            const isHunterAsteroid = Math.random() < directTargetingChance;
            
            // IMPROVED NEAR-PATH SPAWNING: Higher chance of spawning directly in or near player's path
            const directPathChance = randomMode ? 0.2 : 0.75; // 75% chance to spawn in player's path (reduced from 85%)
            const inPlayerPath = Math.random() < directPathChance;
            
            if (inPlayerPath) {
                // Position directly in the player's path with minimal deviation
                // Get player's exact forward path with slight variation
                const minDeviation = 0.1; // Increased from 0.07 for more spread
                const xSpread = (Math.random() * minDeviation * 2) - minDeviation;
                const ySpread = (Math.random() * minDeviation * 2) - minDeviation;
                
                // Create a vector pointing almost exactly where the player is going
                const directPathVector = new THREE.Vector3(
                    playerForward.x + xSpread,
                    playerForward.y + ySpread,
                    playerForward.z
                ).normalize();
                
                // Scale by spawn distance and add to player position
                spawnPosition.add(directPathVector.multiplyScalar(spawnDistance));
                
                if (Math.random() < 0.1) { // Reduce logging
                    console.log(`DIRECT PATH ASTEROID spawned at distance ${spawnDistance.toFixed(1)} units`);
                }
            }
            else {
                // Position near but not directly in player's path
                // This creates asteroids that require navigation but aren't right in front
                const pathOffset = 80 + (Math.random() * 150); // 80-230 units offset from direct path (increased)
                
                // Get a vector perpendicular to forward direction
                const perpendicularDir = new THREE.Vector3(-playerForward.z, 0, playerForward.x).normalize();
                
                // Choose a random side (left or right of path)
                if (Math.random() < 0.5) {
                    perpendicularDir.multiplyScalar(-1);
                }
                
                // Go forward along player path
                const forwardOffset = playerForward.clone().multiplyScalar(spawnDistance);
                
                // Go to the side based on perpendicular direction
                const sideOffset = perpendicularDir.multiplyScalar(pathOffset);
                
                // Combine both offsets
                spawnPosition.add(forwardOffset).add(sideOffset);
                
                if (Math.random() < 0.05) { // Reduce logging
                    console.log(`NEAR PATH ASTEROID spawned at distance ${spawnDistance.toFixed(1)} units with ${pathOffset.toFixed(1)} offset`);
                }
            }
            
            // Set the asteroid position
            asteroid.mesh.position.copy(spawnPosition);
            
            // Ensure it's a large enough size to be visible
            const minScale = 0.035; // Increased min size for better visibility
            const currentScale = asteroid.mesh.scale.x;
            
            if (currentScale < minScale) {
                const newScale = minScale + (Math.random() * 0.02);
                asteroid.mesh.scale.set(newScale, newScale, newScale);
            }
            
            // Randomize asteroid rotation
            asteroid.mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Reset state and properties
            asteroid.velocity = new THREE.Vector3();
            asteroid.creationTime = Date.now();
            
            // ENHANCED TARGETING:
            // 1. Standard targeting (moderate)
            // 2. Hunter asteroids (aggressive)
            // 3. Random movement (minimal targeting)
            
            // Determine targeting type and accuracy
            if (isHunterAsteroid) {
                // HUNTER asteroid - aggressively tracks player with high accuracy
                asteroid.targeting = true;
                asteroid.isHunter = true; // Special flag for hunter asteroids
                
                // Tracking speed - higher is more aggressive turning
                asteroid.targetingSpeed = 0.1 + (Math.random() * 0.15) + (playerSpeed * 0.01);
                
                // Targeting factor - how accurately it tracks (higher = more accurate)
                asteroid.targetingFactor = 0.4 + Math.random() * 0.4 + (playerSpeed * 0.02);
                
                // Set velocity to intersect with player's path with some randomness
                const toPlayer = new THREE.Vector3();
                toPlayer.subVectors(playerMesh.position, spawnPosition).normalize();
                
                // Initial velocity directly toward player's current position
                asteroid.velocity.copy(toPlayer);
                
                // Make hunters visually distinguishable
                if (asteroid.mesh && asteroid.mesh.material) {
                    // Add subtle red tint to hunter asteroids
                    if (Array.isArray(asteroid.mesh.material)) {
                        asteroid.mesh.material.forEach(mat => {
                            mat.color.setRGB(1.0, 0.7, 0.7);
                        });
                    } else {
                        asteroid.mesh.material.color.setRGB(1.0, 0.7, 0.7);
                    }
                }
                
                console.log("Spawned HUNTER asteroid with aggressive tracking");
            } 
            else {
                // Regular asteroid with variable targeting
                // Higher chance of targeting behavior at higher speeds
                const speedBasedTargetingChance = Math.min(0.55, 0.2 + (playerSpeed * 0.025));
                asteroid.targeting = Math.random() < speedBasedTargetingChance;
                asteroid.isHunter = false;
                
                // Moderate targeting for regular asteroids
                asteroid.targetingSpeed = 0.05 + (Math.random() * 0.08) + (playerSpeed * 0.003);
                asteroid.targetingFactor = asteroid.targeting ? (0.15 + Math.random() * 0.2) : 0;
                
                // Calculate vector toward player with transverse motion
                const transverseFactor = Math.random() * 0.3; // Up to 30% sideways motion
                
                // Direction toward player
                const towardPlayer = new THREE.Vector3();
                towardPlayer.subVectors(playerMesh.position, spawnPosition).normalize();
                
                // Get perpendicular vector for sideways motion
                const sideways = new THREE.Vector3(-towardPlayer.z, 0, towardPlayer.x).normalize();
                if (Math.random() < 0.5) sideways.multiplyScalar(-1); // Random direction
                
                // Blend toward-player and sideways vectors
                const moveDir = new THREE.Vector3()
                    .addScaledVector(towardPlayer, 1.0 - transverseFactor)
                    .addScaledVector(sideways, transverseFactor)
                    .normalize();
                
                // Use this mixed direction as velocity
                asteroid.velocity.copy(moveDir);
            }
            
            // Scale velocity with player speed for better game feel
            const minSpeedFactor = 0.35; // Base speed factor
            const speedScaling = 0.04; // How much player speed affects asteroid speed
            
            // Hunters move faster to catch up to player
            const speedFactor = asteroid.isHunter 
                ? (minSpeedFactor * 1.4) + (playerSpeed * speedScaling * 1.3) 
                : minSpeedFactor + (playerSpeed * speedScaling);
                
            asteroid.velocity.multiplyScalar(speedFactor);
            
            // Add slight random variations to make movement less predictable
            // Less randomness for hunters to make their tracking more precise
            const randomFactor = asteroid.isHunter ? 0.02 : 0.04;
            asteroid.velocity.x += (Math.random() * randomFactor - randomFactor/2);
            asteroid.velocity.y += (Math.random() * randomFactor - randomFactor/2);
            asteroid.velocity.z += (Math.random() * randomFactor - randomFactor/2);
            
            // Enhanced rotation for more dynamic movement
            const rotSpeedBase = 0.015;
            const rotSpeedRandom = 0.008;
            asteroid.rotationSpeed = new THREE.Vector3(
                (Math.random() * rotSpeedRandom - rotSpeedRandom/2) + (Math.sign(Math.random()-0.5) * rotSpeedBase),
                (Math.random() * rotSpeedRandom - rotSpeedRandom/2) + (Math.sign(Math.random()-0.5) * rotSpeedBase),
                (Math.random() * rotSpeedRandom - rotSpeedRandom/2) + (Math.sign(Math.random()-0.5) * rotSpeedBase)
            );
            
            // Make sure asteroid is added to the scene
            if (!asteroid.mesh.parent) {
                this.scene.add(asteroid.mesh);
            }
            
            // Force addition to the active asteroids array
            if (!this.asteroids.includes(asteroid)) {
                this.asteroids.push(asteroid);
            }
            
            return asteroid;
        } catch (error) {
            console.error("Error spawning asteroid:", error.message);
            console.error(error.stack);
            return null;
        }
    }

    // Add this helper method to spawn waves with more spacing
    spawnAsteroidWave() {
        if (!this.gameState || !this.gameState.isRunning) return;
        
        // Define patterns for asteroid formations that create navigable paths
        const patterns = [
            'wall', // Horizontal wall with a gap
            'tunnel', // Tunnel-like formation with a passage
            'spiral', // Spiral formation with a clear path
            'random' // Traditional random pattern
        ];
        
        // Select a pattern for this wave - weighted toward more structured patterns
        const patternWeights = [0.4, 0.3, 0.2, 0.1]; // 90% structured, 10% random
        const patternSelector = Math.random();
        let selectedPattern;
        
        let cumulativeWeight = 0;
        for (let i = 0; i < patterns.length; i++) {
            cumulativeWeight += patternWeights[i];
            if (patternSelector <= cumulativeWeight) {
                selectedPattern = patterns[i];
                break;
            }
        }
        
        console.log(`Spawning ${selectedPattern} pattern asteroid wave`);
        
        // Get player position for reference
        const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
        const playerMesh = this.playerMeshes.get(playerId);
        if (!playerMesh) return;
        
        // Spawn the selected pattern
        switch (selectedPattern) {
            case 'wall':
                this.spawnWallPattern(playerMesh.position);
                break;
                
            case 'tunnel':
                this.spawnTunnelPattern(playerMesh.position);
                break;
                
            case 'spiral':
                this.spawnSpiralPattern(playerMesh.position);
                break;
                
            case 'random':
            default:
                // Traditional random wave but with fewer asteroids
                const numAsteroids = Math.floor(
                    this.waveConfig.minAsteroidsPerWave + 
                    Math.random() * (this.waveConfig.maxAsteroidsPerWave - this.waveConfig.minAsteroidsPerWave)
                );
                
                // Spawn asteroids with delays
                for (let i = 0; i < numAsteroids; i++) {
                    setTimeout(() => {
                        this.spawnAsteroid(true);
                    }, i * 300);
                }
                break;
        }
    }
    
    // New method to spawn a wall pattern with a gap to fly through
    spawnWallPattern(playerPosition) {
        // Create a wall of asteroids with a deliberate gap
        const wallDistance = 250; // REDUCED from 350 to 250 to make them appear closer
        
        // Calculate gap size based on difficulty - gets smaller as difficulty increases
        const difficultyFactor = Math.min(this.difficultyLevel / 10, 0.9); // 0 at level 1, 0.9 at level 9+
        const wallWidth = 400; // Total width of wall
        const baseGapSize = 80; // Base size of the gap
        const gapSizeReduction = 40 * difficultyFactor; // Reduces from 0 to 40 units
        const gapSize = Math.max(baseGapSize - gapSizeReduction, 30); // Never smaller than 30 units
        
        const gapPosition = (Math.random() - 0.5) * (wallWidth - gapSize); // Random position for gap
        
        // Calculate base position for the wall (ahead of player)
        const wallBasePosition = playerPosition.clone();
        wallBasePosition.z -= wallDistance;
        
        // Number of asteroids increases with difficulty
        const baseAsteroids = 12;
        const extraAsteroids = Math.floor(this.difficultyLevel / 2); // +1 every 2 levels
        const numAsteroids = baseAsteroids + extraAsteroids;
        const spacing = wallWidth / numAsteroids;
        
        // Create the wall with a gap
        for (let i = 0; i < numAsteroids; i++) {
            const xPos = (i * spacing) - (wallWidth / 2);
            
            // Skip asteroids in the gap area
            if (xPos > gapPosition && xPos < gapPosition + gapSize) {
                continue;
            }
            
            setTimeout(() => {
                this.spawnAsteroidAtPosition(
                    new THREE.Vector3(
                        wallBasePosition.x + xPos,
                        wallBasePosition.y + (Math.random() - 0.5) * 30, // Small Y variation
                        wallBasePosition.z + (Math.random() - 0.5) * 20  // Small Z variation
                    )
                );
            }, i * 100);
        }
    }
    
    // New method to spawn a tunnel pattern to fly through
    spawnTunnelPattern(playerPosition) {
        // Create two parallel walls forming a tunnel
        const tunnelDistance = 250; // REDUCED from 350 to 250
        const tunnelLength = 300; 
        
        // Tunnel width gets smaller as difficulty increases
        const difficultyFactor = Math.min(this.difficultyLevel / 10, 0.9);
        const baseTunnelWidth = 100; // Base width of navigable space
        const narrowing = 50 * difficultyFactor; // Narrows by up to 50 units
        const tunnelWidth = Math.max(baseTunnelWidth - narrowing, 40); // Never smaller than 40 units
        
        // More tunnel segments at higher difficulties
        const baseSegments = 8;
        const extraSegments = Math.floor(this.difficultyLevel / 3); // +1 every 3 levels
        const numSegments = baseSegments + extraSegments;
        
        // Calculate base position for the tunnel
        const tunnelBasePosition = playerPosition.clone();
        tunnelBasePosition.z -= tunnelDistance;
        
        // Calculate tunnel center with slight offset from player position
        const tunnelCenterX = playerPosition.x + (Math.random() - 0.5) * 50;
        const tunnelCenterY = playerPosition.y + (Math.random() - 0.5) * 50;
        
        // Curve angle increases with difficulty
        const curveAngleFactor = 0.5 + (0.3 * difficultyFactor); // 0.5 at level 1, up to 0.8 at high levels
        
        // Spawn segments of the tunnel
        for (let segment = 0; segment < numSegments; segment++) {
            const segmentZ = tunnelBasePosition.z - (segment * (tunnelLength / numSegments));
            const segmentAngle = (segment / numSegments) * Math.PI * curveAngleFactor; // Gradually curve the tunnel
            
            // More asteroids per segment at higher difficulties
            const baseAsteroidsPerSegment = 4;
            const extraAsteroidsPerSegment = Math.floor(this.difficultyLevel / 4); // +1 every 4 levels
            const asteroidsPerSegment = baseAsteroidsPerSegment + extraAsteroidsPerSegment;
            
            for (let i = 0; i < asteroidsPerSegment; i++) {
                const angleOffset = (i / asteroidsPerSegment) * Math.PI * 2;
                
                // Left wall asteroid
                setTimeout(() => {
                    this.spawnAsteroidAtPosition(
                        new THREE.Vector3(
                            tunnelCenterX + Math.cos(segmentAngle + angleOffset) * (tunnelWidth + 20),
                            tunnelCenterY + Math.sin(segmentAngle + angleOffset) * (tunnelWidth + 20),
                            segmentZ + (Math.random() - 0.5) * 10
                        )
                    );
                }, (segment * asteroidsPerSegment + i) * 80);
                
                // Right wall asteroid
                setTimeout(() => {
                    this.spawnAsteroidAtPosition(
                        new THREE.Vector3(
                            tunnelCenterX - Math.cos(segmentAngle + angleOffset) * (tunnelWidth + 20),
                            tunnelCenterY - Math.sin(segmentAngle + angleOffset) * (tunnelWidth + 20),
                            segmentZ + (Math.random() - 0.5) * 10
                        )
                    );
                }, (segment * asteroidsPerSegment + i) * 80 + 40);
            }
        }
    }
    
    // New method to spawn a spiral pattern to navigate through
    spawnSpiralPattern(playerPosition) {
        // Create a spiral of asteroids with a navigable path
        const spiralDistance = 250; // REDUCED from 350 to 250
        
        // Spiral gets tighter with difficulty
        const difficultyFactor = Math.min(this.difficultyLevel / 10, 0.9);
        const baseRadius = 150; // Base initial radius
        const radiusReduction = 30 * difficultyFactor; // Reduces by up to 30 units
        const spiralRadius = baseRadius - radiusReduction; // Gets smaller with difficulty
        
        // More turns with higher difficulty
        const baseTurns = 1.5;
        const extraTurns = difficultyFactor * 1.0; // Up to 1 extra turn
        const spiralTurns = baseTurns + extraTurns;
        
        // More asteroids with higher difficulty
        const baseAsteroids = 20;
        const extraAsteroids = Math.floor(this.difficultyLevel / 2) * 5; // +5 every 2 levels
        const numAsteroids = baseAsteroids + extraAsteroids;
        
        // Calculate base position for the spiral
        const spiralBasePosition = playerPosition.clone();
        spiralBasePosition.z -= spiralDistance;
        
        // Spawn asteroids in a spiral pattern
        for (let i = 0; i < numAsteroids; i++) {
            const t = i / numAsteroids;
            const angle = t * Math.PI * 2 * spiralTurns;
            
            // Spiral gets tighter faster with difficulty
            const tighteningFactor = 0.6 + (0.2 * difficultyFactor); // 0.6 at level 1, up to 0.8
            const radius = spiralRadius * (1 - t * tighteningFactor);
            
            setTimeout(() => {
                this.spawnAsteroidAtPosition(
                    new THREE.Vector3(
                        spiralBasePosition.x + Math.cos(angle) * radius,
                        spiralBasePosition.y + Math.sin(angle) * radius,
                        spiralBasePosition.z - t * 200 // Spiral moves away from player
                    )
                );
            }, i * 100);
        }
    }
    
    // Helper to spawn asteroid at a specific position
    spawnAsteroidAtPosition(position) {
        // Check if we're in a game state where we should spawn asteroids
        if (!this.gameState || !this.gameState.isRunning) return;
        
        try {
            // Create new asteroid object
            const asteroid = {
                mesh: null,
                velocity: new THREE.Vector3(),
                rotation: new THREE.Vector3(),
                size: 0,
                targeting: false,
                targetingSpeed: 0,
                speed: 0,
                inactive: false
            };
            
            // Randomize asteroid size but keep them small
            asteroid.size = 0.2 + Math.random() * 0.4;
            
            // Use a random asteroid model
            if (this.models && this.models.asteroids && this.models.asteroids.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.models.asteroids.length);
                const randomModel = this.models.asteroids[randomIndex];
                asteroid.mesh = randomModel.clone();
            } else {
                // Fallback to basic mesh
                const fallbackGeometry = new THREE.SphereGeometry(1, 8, 8);
                const fallbackMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x888888,
                    wireframe: Math.random() > 0.5
                });
                asteroid.mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            }
            
            // Scale the asteroid to be small
            asteroid.mesh.scale.set(asteroid.size * 0.15, asteroid.size * 0.15, asteroid.size * 0.15);
            
            // Set position directly
            asteroid.mesh.position.copy(position);
            asteroid.mesh.visible = true;
            this.scene.add(asteroid.mesh);
            
            // Initialize asteroid properties
            asteroid.active = true;
            asteroid.creationTime = Date.now();
            
            // Almost no targeting for pattern asteroids
            asteroid.targetingFactor = 0.05;
            
            // Minimal velocity - just enough to approach player
            const difficultySpeedMultiplier = 1 + (this.difficultyLevel - 1) * 0.1;
            const baseSpeed = 0.3 * difficultySpeedMultiplier;
            
            // Direction mostly based on player position but with small random component
            const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
            const playerMesh = this.playerMeshes.get(playerId);
            
            if (playerMesh) {
                const playerDirection = new THREE.Vector3().subVectors(
                    playerMesh.position, 
                    position
                ).normalize();
                
                // Add slight randomness
                const randomDirection = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1,
                    1
                ).normalize();
                
                // Blend directions - mostly towards player to maintain pattern
                const direction = new THREE.Vector3()
                    .addScaledVector(randomDirection, 0.1)
                    .addScaledVector(playerDirection, 0.9)
                    .normalize();
                
                asteroid.velocity.copy(direction.multiplyScalar(baseSpeed));
            } else {
                // Fallback if no player mesh
                asteroid.velocity.set(0, 0, baseSpeed);
            }
            
            // Set random rotation
            asteroid.mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            // Add to collection
            this.asteroids.push(asteroid);
            
            return asteroid;
        } catch (error) {
            console.error('Error spawning positioned asteroid:', error);
            return null;
        }
    }

    cleanupAsteroids() {
        if (!this.playerMeshes || !this.asteroids) return;
        
        // Get player position for reference
        const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
        const playerMesh = this.playerMeshes.get(playerId);
        
        if (!playerMesh) return;
        
        // Get current player speed (if available)
        let playerSpeed = 1.0;
        if (this.controls && this.controls.baseSpeed) {
            playerSpeed = this.controls.baseSpeed;
        }
        
        // Scale cleanup distance with player speed
        // At higher speeds, we need a larger cleanup radius to prevent asteroids from lingering too long
        const cleanupDistance = 700 * Math.max(1.0, playerSpeed * 0.8);
        
        // Count asteroids at start
        const startCount = this.asteroids.length;
        let removedCount = 0;
        
        // Check each asteroid
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.asteroids[i];
            
            if (!asteroid || !asteroid.mesh) continue;
            
            const distance = playerMesh.position.distanceTo(asteroid.mesh.position);
            
            // If too far from player, return to pool for reuse
            if (distance > cleanupDistance) {
                this.returnAsteroidToPool(asteroid);
                removedCount++;
            }
        }
        
        // Log cleanup if significant number removed
        if (removedCount > 5) {
            console.log(`Returned ${removedCount} distant asteroids to pool (${this.inactiveAsteroids.length} available)`);
        }
    }

    updateAsteroids(dt) {
        // Skip if game is not running
        if (!this.gameState || !this.gameState.isRunning) return;
        
        // Safety check
        if (!this.asteroids) return;
        
        try {
            // Get player mesh
            const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
            const playerMesh = this.playerMeshes.get(playerId);
            
            if (!playerMesh) return; // Can't update without player mesh
            
            // Get player position for distance calculations
            const playerPos = playerMesh.position.clone();
            
            // Get player's current speed
            let playerSpeed = 1.0;
            if (this.controls && this.controls.baseSpeed) {
                playerSpeed = this.controls.baseSpeed;
            }
            
            // Track visible asteroids for stats and debugging
            let visibleCount = 0;
            
            // Local temp array to store collisions
            const collisionResults = [];
            
            // Update each asteroid
            for (let i = 0; i < this.asteroids.length; i++) {
                const asteroid = this.asteroids[i];
                
                // Skip invalid asteroids
                if (!asteroid || !asteroid.mesh) {
                    continue;
                }
                
                // Count how many asteroids are actually visible
                if (asteroid.mesh.visible) {
                    visibleCount++;
                } else {
                    // Force visibility on
                    asteroid.mesh.visible = true;
                }
                
                // IMPROVED TARGETING BEHAVIOR with variable accuracy
                if (asteroid.targetingFactor > 0) {
                    // Calculate direction to player
                    const toPlayer = new THREE.Vector3().subVectors(playerPos, asteroid.mesh.position).normalize();
                    
                    // Current direction
                    const currentDir = asteroid.velocity.clone().normalize();
                    
                    // Adjust targeting strength based on proximity to make close encounters more challenging
                    const distance = asteroid.mesh.position.distanceTo(playerPos);
                    
                    // Different proximity factors for regular vs hunter asteroids
                    let proximityFactor;
                    
                    if (asteroid.isHunter) {
                        // Hunters get more accurate as they get closer
                        proximityFactor = Math.max(0.8, Math.min(3.0, 800 / Math.max(10, distance)));
                    } else {
                        // Regular asteroids have moderate proximity adjustment
                        proximityFactor = Math.max(0.5, Math.min(1.5, 400 / Math.max(10, distance)));
                    }
                    
                    // Add some randomization to targeting accuracy (variable accuracy)
                    const accuracyVariance = asteroid.isHunter ? 0.1 : 0.3; // Hunters have less variance
                    const randomAccuracyFactor = 1.0 - (Math.random() * accuracyVariance);
                    
                    // Calculate adjustment strength based on targeting factor with accuracy variation
                    const adjustmentStrength = asteroid.targetingFactor * asteroid.targetingSpeed * 
                                              proximityFactor * randomAccuracyFactor;
                    
                    // Blend current direction with player direction
                    const newDir = new THREE.Vector3()
                        .addScaledVector(currentDir, 1.0 - adjustmentStrength)
                        .addScaledVector(toPlayer, adjustmentStrength)
                        .normalize();
                    
                    // Adjust speed based on player speed to maintain challenge
                    // Hunters move faster to catch up
                    let speedFactor;
                    if (asteroid.isHunter) {
                        // Hunters move faster than regular asteroids
                        speedFactor = 0.3 + (playerSpeed * 0.05);
                    } else {
                        // Regular asteroids move at moderate speeds
                        speedFactor = 0.2 + (playerSpeed * 0.03);
                    }
                    
                    // Set the new velocity
                    asteroid.velocity.copy(newDir).multiplyScalar(speedFactor);
                }
                
                // Update position based on velocity
                asteroid.mesh.position.add(asteroid.velocity);
                
                // Apply rotation
                if (asteroid.rotationSpeed) {
                    asteroid.mesh.rotation.x += asteroid.rotationSpeed.x;
                    asteroid.mesh.rotation.y += asteroid.rotationSpeed.y;
                    asteroid.mesh.rotation.z += asteroid.rotationSpeed.z;
                }
                
                // Calculate distance from player
                const distance = asteroid.mesh.position.distanceTo(playerPos);
                
                // Close enough for collision?
                const collisionThreshold = 10 + (asteroid.size || 1) * 0.7;
                if (distance < collisionThreshold) {
                    collisionResults.push(asteroid);
                }
                
                // Check if out of range (too far from player)
                // Use a larger distance for hunters so they can track from further away
                const maxDistance = asteroid.isHunter ? 
                    (3000 + (playerSpeed * 300)) : // Hunters stay visible longer
                    (2000 + (playerSpeed * 200));  // Regular asteroids
                    
                if (distance > maxDistance && !asteroid.isEmergency) {
                    // Return asteroid to pool and remove from active list
                    this.returnAsteroidToPool(asteroid);
                    this.asteroids.splice(i, 1);
                    i--; // Adjust index after removal
                }
            }
            
            // Process any collisions
            collisionResults.forEach(asteroid => {
                this.handleAsteroidCollision(asteroid);
            });
            
            // Log stats occasionally
            if (Math.random() < 0.005) {
                console.log(`Visible asteroids: ${visibleCount}/${this.asteroids.length}, Hunters: ${this.asteroids.filter(a => a.isHunter).length}`);
            }
        }
        catch (err) {
            console.error("Error in updateAsteroids:", err);
        }
    }

    handleAsteroidCollision(asteroid) {
        // Reduced cooldown from 200ms to 150ms for more responsive collisions
        if (!this.localPlayer.lastCollisionTime || 
            Date.now() - this.localPlayer.lastCollisionTime > 150) {
            
            // Fixed damage of 10 per hit
            const damage = 10;
            
            this.localPlayer.health = Math.max(0, this.localPlayer.health - damage);
            this.localPlayer.lastCollisionTime = Date.now();

            // Create explosion effect
            this.createExplosion(asteroid.mesh.position);

            // Remove asteroid from scene
            this.scene.remove(asteroid.mesh);
            
            // Mark asteroid as inactive
            asteroid.inactive = true;
            
            // Remove asteroid from the array
            const index = this.asteroids.indexOf(asteroid);
            if (index !== -1) {
                this.asteroids.splice(index, 1);
            }

            // Flash effect with longer duration
            const damageFlash = document.createElement('div');
            damageFlash.style.position = 'fixed';
            damageFlash.style.top = '0';
            damageFlash.style.left = '0';
            damageFlash.style.width = '100%';
            damageFlash.style.height = '100%';
            damageFlash.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            damageFlash.style.pointerEvents = 'none';
            damageFlash.style.zIndex = '1000';
            document.body.appendChild(damageFlash);

            setTimeout(() => {
                document.body.removeChild(damageFlash);
            }, 150);

            // Play collision sound with higher volume
            const collisionSound = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
            collisionSound.volume = 0.6;
            collisionSound.play().catch(e => console.log('Audio play failed:', e));

            // Update health display immediately
            const healthDisplay = document.getElementById('health-display');
            if (healthDisplay) {
                healthDisplay.textContent = `Health: ${Math.round(this.localPlayer.health)}%`;
                // Make health display flash red when hit
                healthDisplay.style.color = '#ff0000';
                setTimeout(() => {
                    healthDisplay.style.color = '#00ff00';
                }, 150);
            }

            // Notify server of health change if connected
            if (this.network && !this.network.singlePlayerMode) {
                const playerMesh = this.playerMeshes.get(this.network.playerId);
                if (playerMesh) {
                    this.network.updatePlayer(
                        playerMesh.position,
                        playerMesh.rotation,
                        this.localPlayer.health
                    );
                }
            }

            // Game over if health reaches 0
            if (this.localPlayer.health <= 0) {
                // IMPORTANT: Mark the game as over
                this.gameState.isRunning = false;
                
                // Mark player as eliminated
                this.localPlayer.eliminated = true;
                
                // Notify server if connected
                if (this.network && !this.network.singlePlayerMode) {
                    this.network.gameOver();
                }
                
                // Show game over message locally
                const gameOverMessage = document.createElement('div');
                gameOverMessage.style.position = 'fixed';
                gameOverMessage.style.top = '50%';
                gameOverMessage.style.left = '50%';
                gameOverMessage.style.transform = 'translate(-50%, -50%)';
                gameOverMessage.style.color = '#ff0000';
                gameOverMessage.style.fontFamily = 'Arial, sans-serif';
                gameOverMessage.style.fontSize = '72px';
                gameOverMessage.style.fontWeight = 'bold';
                gameOverMessage.style.textShadow = '0 0 20px #ff0000';
                gameOverMessage.style.zIndex = '1000';
                gameOverMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                gameOverMessage.style.padding = '40px 80px';
                gameOverMessage.style.borderRadius = '20px';
                gameOverMessage.style.border = '3px solid #ff0000';
                gameOverMessage.textContent = "GAME OVER";
                document.body.appendChild(gameOverMessage);
                
                // Disable player controls
                this.disableControls();
                
                console.log("GAME OVER - Stopping gameplay updates while maintaining visuals");
            }
        }
    }

    disableControls() {
        // Disable all controls when player is eliminated
        this.controls.up = false;
        this.controls.down = false;
        this.controls.left = false;
        this.controls.right = false;
        this.controls.boost = false;
        // Mouse controls removed
        
        // Set a flag to prevent control input
        this.localPlayer.eliminated = true;
    }
    
    createSpeedDisplay() {
        const display = document.createElement('div');
        display.id = 'speed-display';
        display.style.position = 'fixed';
        display.style.top = '100px';
        display.style.right = '20px';
        display.style.color = '#00ffff';
        display.style.fontFamily = 'Arial, sans-serif';
        display.style.fontSize = '24px';
        display.style.padding = '15px';
        display.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        display.style.borderRadius = '8px';
        display.style.zIndex = '1000';
        display.style.border = '2px solid #00ffff';
        display.style.textShadow = '0 0 5px #00ffff';
        display.style.width = '200px';
        display.style.textAlign = 'right';
        document.body.appendChild(display);
        return display;
    }
    
    createDistanceDisplay() {
        const display = document.createElement('div');
        display.id = 'distance-display';
        display.style.position = 'fixed';
        display.style.top = '20px';
        display.style.right = '20px';
        display.style.color = 'white';
        display.style.fontFamily = 'Arial, sans-serif';
        display.style.fontSize = '18px';
        display.style.padding = '10px';
        display.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        display.style.borderRadius = '5px';
        display.style.width = '200px';
        display.style.textAlign = 'right';
        document.body.appendChild(display);
        return display;
    }
    
    updateMovement() {
        if (!this.gameState.isRunning) {
            // If game hasn't started, keep camera in initial position
            this.camera.position.lerp(new THREE.Vector3(0, 5, 15), 0.1);
            this.camera.lookAt(0, 0, 0);
            return;
        }

        // Get the player mesh, needed for movement
        let playerId = null;
        if (this.singlePlayerMode) {
            playerId = 'local-player';
        } else if (this.network && this.network.playerId) {
            playerId = this.network.playerId;
        }
        
        // If we don't have a valid player ID, we can't move
        if (!playerId) {
            console.warn('No valid player ID found for movement');
            return;
        }
        
        const playerMesh = this.playerMeshes.get(playerId);
        
        if (!playerMesh) {
            console.warn('No player mesh found for player ID:', playerId);
            return;
        }
        
        // If player is eliminated, just update camera but don't allow movement
        if (this.localPlayer.eliminated) {
            this.updateCameraZoom();
            return;
        }

        // Calculate current speed with smoother acceleration/deceleration
        const targetSpeed = this.controls.boost ? 
            this.controls.baseSpeed * this.controls.boostMultiplier : 
            this.controls.baseSpeed;
            
        this.controls.currentSpeed = THREE.MathUtils.lerp(
            this.controls.currentSpeed, 
            targetSpeed, 
            0.1 // Smooth acceleration factor
        );

        // Store previous position for distance calculation
        const previousPosition = playerMesh.position.clone();

        // Always move forward regardless of control method
        const forwardDirection = new THREE.Vector3(0, 0, -1);
        forwardDirection.applyQuaternion(playerMesh.quaternion);
        forwardDirection.multiplyScalar(this.controls.currentSpeed);
        
        // Move player forward without boundary checking
        playerMesh.position.add(forwardDirection);

        // Initialize movement variables
        let moveX = 0;
        let moveY = 0;
        let rotX = 0;
        let rotZ = 0;

        // Apply keyboard input if any keys are pressed
        if (this.controls.up) {
            moveY += this.controls.verticalSpeed;
            rotX = 0.5; // Tilt up
        } else if (this.controls.down) {
            moveY -= this.controls.verticalSpeed;
            rotX = -0.5; // Tilt down
        }

        if (this.controls.left) {
            moveX -= this.controls.horizontalSpeed;
            rotZ = 0.5; // Tilt left
        } else if (this.controls.right) {
            moveX += this.controls.horizontalSpeed;
            rotZ = -0.5; // Tilt right
        }

        // Apply lateral movement directly without boundary checking
            playerMesh.position.x += moveX;
            playerMesh.position.y += moveY;
        
        // Apply rotation with smooth transitions
        playerMesh.rotation.x = THREE.MathUtils.lerp(playerMesh.rotation.x, rotX, 0.05);
        playerMesh.rotation.z = THREE.MathUtils.lerp(playerMesh.rotation.z, rotZ, 0.05);
        
        // If no inputs are active, gradually return to neutral position
        if (moveX === 0 && moveY === 0) {
            playerMesh.rotation.x = THREE.MathUtils.lerp(playerMesh.rotation.x, 0, 0.05);
            playerMesh.rotation.z = THREE.MathUtils.lerp(playerMesh.rotation.z, 0, 0.05);
        }

        // Update camera position
        this.updateCameraZoom();

        // Calculate actual distance moved
        if (!this.localPlayer.distanceTraveled) {
            this.localPlayer.distanceTraveled = 0;
        }

        // Calculate true distance moved in 3D space
        const distanceMoved = playerMesh.position.distanceTo(previousPosition);
        this.localPlayer.distanceTraveled += distanceMoved;

        // Update distance display
        const distanceDisplay = document.getElementById('distance-display') || this.createDistanceDisplay();
        distanceDisplay.textContent = `Distance: ${Math.round(this.localPlayer.distanceTraveled)} units`;

        // Update speed display
        const speedDisplay = document.getElementById('speed-display') || this.createSpeedDisplay();
        const currentSpeedKmh = Math.round(this.controls.currentSpeed * 100); // Convert to km/h equivalent
        speedDisplay.textContent = `Speed: ${currentSpeedKmh} km/h`;

        // Remove boundary indicator completely - no longer needed

        // Update health display every frame
        const healthDisplay = document.getElementById('health-display');
        if (healthDisplay) {
            healthDisplay.textContent = `Health: ${Math.round(this.localPlayer.health)}%`;
        }

        // Send update to server if connected
        if (this.network && !this.network.singlePlayerMode) {
            this.network.updatePlayer(
                playerMesh.position,
                playerMesh.rotation,
                this.localPlayer.health
            );
        }
    }
    
    handleKeyDown(event) {
        // If player is eliminated, ignore all key inputs
        if (!this.gameState.isRunning || !this.localPlayer || this.localPlayer.eliminated) return;

        // Only process the event if it exists and has a key property
        if (!event || !event.key) return;

        // Prevent default browser behavior for game controls
        if (['w', 's', 'a', 'd', ' ', 'shift', 'q', 'e'].includes(event.key.toLowerCase())) {
            event.preventDefault();
        }

        switch (event.key.toLowerCase()) {
            case 'w':
                this.controls.up = true;
                break;
            case 's':
                this.controls.down = true;
                break;
            case 'a':
                this.controls.left = true;
                break;
            case 'd':
                this.controls.right = true;
                break;
            case 'shift':
                this.controls.boost = true;
                break;
            case ' ': // Spacebar to shoot
                this.handleShooting();
                break;
        }

        // Handle zoom with Q and E keys
        if (event.key.toLowerCase() === 'q') {
            this.cameraSettings.currentZoom = Math.min(
                this.cameraSettings.maxZoom,
                this.cameraSettings.currentZoom + this.cameraSettings.zoomSpeed
            );
            this.updateCameraZoom();
        } else if (event.key.toLowerCase() === 'e') {
            this.cameraSettings.currentZoom = Math.max(
                this.cameraSettings.minZoom,
                this.cameraSettings.currentZoom - this.cameraSettings.zoomSpeed
            );
            this.updateCameraZoom();
        }
    }

    handleShooting() {
        // If player is eliminated, they cannot shoot
        if (this.localPlayer.eliminated) return;
        
        const now = Date.now();
        if (now - this.lastShot >= this.SHOT_COOLDOWN) {
            // Get player mesh using the same pattern as updateMovement
            let playerId = null;
            if (this.singlePlayerMode) {
                playerId = 'local-player';
            } else if (this.network && this.network.playerId) {
                playerId = this.network.playerId;
            }
            
            if (!playerId) return;
            
            const playerMesh = this.playerMeshes.get(playerId);
            if (!playerMesh) return;
            
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(playerMesh.quaternion);
            
            // Create projectile slightly in front of ship
            const projectilePos = playerMesh.position.clone();
            projectilePos.add(direction.multiplyScalar(3));
            
            this.createProjectile(projectilePos, direction);
            this.lastShot = now;
            
            // Send shot event to server
            if (this.network && !this.network.singlePlayerMode) {
            this.network.shoot(projectilePos, direction);
            }
        }
    }

    setupThreeJS() {
        // Setup Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0025);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Set initial camera position
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight, directionalLight);

        // Create dynamic starfield
        this.createDynamicStarfield();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // Completely revised starfield creation method
    createDynamicStarfield() {
        console.log("Creating improved starfield system");
        
        // Clear any existing starfields
        if (this.starfield) {
            this.scene.remove(this.starfield);
        }
        if (this.backgroundStarfieldContainer) {
            this.scene.remove(this.backgroundStarfieldContainer);
        }
        
        // Create background stars fixed to the camera
        const backgroundStarCount = 6000;
        const backgroundGeometry = new THREE.BufferGeometry();
        const backgroundPositions = new Float32Array(backgroundStarCount * 3);
        const backgroundSizes = new Float32Array(backgroundStarCount);
        const backgroundColors = new Float32Array(backgroundStarCount * 3);
        
        // Create stars in a sphere around the camera
        for (let i = 0; i < backgroundStarCount; i++) {
            const i3 = i * 3;
            
            // Use spherical coordinates for even distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 2000;
            
            // Convert to Cartesian coordinates
            backgroundPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            backgroundPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            backgroundPositions[i3 + 2] = radius * Math.cos(phi);
            
            // Random star sizes - small for background
            backgroundSizes[i] = Math.random() * 1.0 + 0.5;
            
            // Simple white/blue stars
            const brightness = 0.8 + Math.random() * 0.2;
            backgroundColors[i3] = brightness;
            backgroundColors[i3 + 1] = brightness;
            backgroundColors[i3 + 2] = brightness;
        }
        
        backgroundGeometry.setAttribute('position', new THREE.BufferAttribute(backgroundPositions, 3));
        backgroundGeometry.setAttribute('size', new THREE.BufferAttribute(backgroundSizes, 1));
        backgroundGeometry.setAttribute('color', new THREE.BufferAttribute(backgroundColors, 3));
        
        const backgroundMaterial = new THREE.PointsMaterial({
            size: 1.5,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            depthTest: false // Stars always visible
        });
        
        this.backgroundStarfield = new THREE.Points(backgroundGeometry, backgroundMaterial);
        
        // Create container to allow positioning with camera
        this.backgroundStarfieldContainer = new THREE.Object3D();
        this.backgroundStarfieldContainer.add(this.backgroundStarfield);
        this.scene.add(this.backgroundStarfieldContainer);
        
        // Create the foreground dynamic stars
        const dynamicStarCount = 5000;
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(dynamicStarCount * 3);
        const starSizes = new Float32Array(dynamicStarCount);
        const starColors = new Float32Array(dynamicStarCount * 3);
        
        // Create stars with initial positions
        for (let i = 0; i < dynamicStarCount; i++) {
            const i3 = i * 3;
            
            // Random positions in a sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 300 + Math.random() * 700;
            
            starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starPositions[i3 + 2] = radius * Math.cos(phi);
            
            // Random sizes - slightly larger for foreground
            starSizes[i] = Math.random() * 2.0 + 0.7;
            
            // Simple white/blue stars
            const brightness = 0.8 + Math.random() * 0.2;
            starColors[i3] = brightness;
            starColors[i3 + 1] = brightness;
            starColors[i3 + 2] = brightness;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        
        const starMaterial = new THREE.PointsMaterial({
            size: 1.8,
            sizeAttenuation: true,
            transparent: true,
            opacity: 1.0,
            vertexColors: true,
            depthTest: false // Stars always visible
        });
        
        this.starfield = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starfield);
        
        // Add necessary tracking properties to starfield
        this.starfield.lastPlayerPosition = new THREE.Vector3(0, 0, 0);
        this.starfield.speeds = new Float32Array(dynamicStarCount);
        for (let i = 0; i < dynamicStarCount; i++) {
            this.starfield.speeds[i] = Math.random() * 2 + 0.5;
        }
        
        // Track reset timing
        this.lastStarResetTime = Date.now();
        this.lastResetDistance = 0;
        this.startPlayerPosition = null;
        
        console.log("Improved starfield created with", dynamicStarCount, "dynamic stars and", backgroundStarCount, "background stars");
    }

    // Unified star reset method
    resetStars(playerPosition) {
        if (!this.starfield || !this.starfield.geometry || 
            !this.starfield.geometry.attributes.position || !playerPosition) {
            console.error("Cannot reset stars: invalid parameters");
            return;
        }

            const positions = this.starfield.geometry.attributes.position.array;
        
        // Reset all dynamic stars around player
        for (let i = 0; i < positions.length; i += 3) {
            // Random direction from player
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const radius = 300 + Math.random() * 700;
            
            // 80% chance to position stars in front of player
            if (Math.random() < 0.8) {
                // Get player forward direction
                const forwardDirection = new THREE.Vector3(0, 0, -1);
                if (this.camera && this.camera.quaternion) {
                    forwardDirection.applyQuaternion(this.camera.quaternion);
                }
                
                // Add some randomness to direction
                const randomizedDirection = forwardDirection.clone();
                randomizedDirection.x += (Math.random() - 0.5) * 1.0;
                randomizedDirection.y += (Math.random() - 0.5) * 1.0;
                randomizedDirection.z += (Math.random() - 0.5) * 1.0;
                randomizedDirection.normalize();
                
                // Position star in this direction
                positions[i] = playerPosition.x + randomizedDirection.x * radius;
                positions[i + 1] = playerPosition.y + randomizedDirection.y * radius;
                positions[i + 2] = playerPosition.z + randomizedDirection.z * radius;
            } else {
                // Standard spherical distribution
                positions[i] = playerPosition.x + radius * Math.sin(phi) * Math.cos(theta);
                positions[i + 1] = playerPosition.y + radius * Math.sin(phi) * Math.sin(theta);
                positions[i + 2] = playerPosition.z + radius * Math.cos(phi);
            }
        }
        
        // Mark geometry for update
        this.starfield.geometry.attributes.position.needsUpdate = true;
    }

    // Single, consolidated updateStarfield method
    updateStarfield() {
        // Skip if essential components are missing
        if (!this.starfield || !this.localPlayer) return;
        
        // Get player mesh with safety checks
        const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
        if (!playerId) return;
        
        const playerMesh = this.playerMeshes?.get(playerId);
        if (!playerMesh) return;
        
        // Ensure background stars follow the camera
        if (this.backgroundStarfieldContainer && this.camera) {
            this.backgroundStarfieldContainer.position.copy(this.camera.position);
        }
        
        // Initialize player reference position if needed
        if (!this.startPlayerPosition) {
            this.startPlayerPosition = playerMesh.position.clone();
        }
        
        // Track player movement
        if (!this.starfield.lastPlayerPosition) {
            this.starfield.lastPlayerPosition = new THREE.Vector3(0, 0, 0);
        }
        
        // Get positions array safely
        const positions = this.starfield.geometry.attributes.position.array;
        if (!positions) return;
        
        // Ensure speeds array exists
        if (!this.starfield.speeds) {
            this.starfield.speeds = new Float32Array(positions.length / 3);
            for (let i = 0; i < this.starfield.speeds.length; i++) {
                this.starfield.speeds[i] = Math.random() * 2 + 0.5;
            }
        }
        
        // Get player movement direction
        const forwardDirection = new THREE.Vector3(0, 0, -1);
        if (playerMesh.quaternion) {
            forwardDirection.applyQuaternion(playerMesh.quaternion);
        }
        forwardDirection.normalize();
        
        // Get current distance and time
        const distanceTraveled = this.localPlayer.distanceTraveled || 0;
        const currentTime = Date.now();
        
        // Only reset based on time every 20 seconds - reduced frequency
        if (currentTime - (this.lastStarResetTime || 0) > 20000) {
            this.lastStarResetTime = currentTime;
            console.log("Time-based star reset (partial)");
            this.partialResetStars(playerMesh.position, forwardDirection);
            return;
        }
        
        // Reset based on distance - only after significant travel
        if (!this.lastResetDistance) this.lastResetDistance = 0;
        if (distanceTraveled - this.lastResetDistance > 800) {
            this.lastResetDistance = distanceTraveled;
            console.log("Distance-based star regeneration (ahead only)");
            this.regenerateStarsAhead(playerMesh.position, forwardDirection);
            return;
        }
        
        // Get player speed for scaling
        let moveSpeed = 1.0;
        if (this.controls && typeof this.controls.baseSpeed === 'number') {
            moveSpeed = this.controls.baseSpeed * 0.5; // Reduced for visual balance
        }
        
        // Move stars to create motion illusion
            for (let i = 0; i < positions.length; i += 3) {
            // Move stars based on player direction
            positions[i] -= forwardDirection.x * this.starfield.speeds[i / 3] * moveSpeed;
            positions[i + 1] -= forwardDirection.y * this.starfield.speeds[i / 3] * moveSpeed;
            positions[i + 2] -= forwardDirection.z * this.starfield.speeds[i / 3] * moveSpeed;
            
            // Calculate vector from player to star
            const toStar = new THREE.Vector3(
                positions[i] - playerMesh.position.x,
                positions[i + 1] - playerMesh.position.y,
                positions[i + 2] - playerMesh.position.z
            );
            
            // Calculate distance from player
            const distSq = toStar.lengthSq();
            
            // Only reset stars if:
            // 1. They're very far from the player (over 1500 units) OR
            // 2. They're behind the player (dot product with forward direction is negative)
            //    AND they're at least 400 units behind
            const dotProduct = toStar.dot(forwardDirection);
            
            // Star is behind player AND far enough away, OR star is extremely far in any direction
            if ((dotProduct < 0 && distSq > 400*400) || distSq > 1500*1500) {
                // Create a new star ahead of the player
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 0.6 - 0.3); // Focus more stars ahead
                const radius = 400 + Math.random() * 300;
                
                // Base position on player's forward direction
                // Get a position ahead of the player in their general direction
                const adjustedDirection = forwardDirection.clone();
                
                // Add some randomness but keep the general forward direction
                adjustedDirection.x += (Math.random() - 0.5) * 0.8;
                adjustedDirection.y += (Math.random() - 0.5) * 0.8;
                adjustedDirection.z += (Math.random() - 0.5) * 0.8;
                adjustedDirection.normalize();
                
                // Position star ahead of player
                positions[i] = playerMesh.position.x + adjustedDirection.x * radius;
                positions[i + 1] = playerMesh.position.y + adjustedDirection.y * radius;
                positions[i + 2] = playerMesh.position.z + adjustedDirection.z * radius;
                
                // Assign new random speed
                this.starfield.speeds[i / 3] = Math.random() * 2 + 0.5;
            }
        }
        
        // Store current player position for next frame
        this.starfield.lastPlayerPosition.copy(playerMesh.position);
        
        // Update geometry
        this.starfield.geometry.attributes.position.needsUpdate = true;
    }
    
    // Method to regenerate stars only ahead of the player
    regenerateStarsAhead(playerPosition, forwardDirection) {
        if (!this.starfield || !this.starfield.geometry || 
            !this.starfield.geometry.attributes.position || !playerPosition) {
            return;
        }
        
        const positions = this.starfield.geometry.attributes.position.array;
        
        // Determine how many stars to regenerate (30% of total)
        const totalStars = positions.length / 3;
        const starsToRegenerate = Math.floor(totalStars * 0.3);
        
        // Arrays to track which stars to regenerate
        const starIndices = [];
        for (let i = 0; i < totalStars; i++) {
            const idx = i * 3;
            
            // Calculate vector from player to star
            const toStar = new THREE.Vector3(
                positions[idx] - playerPosition.x,
                positions[idx + 1] - playerPosition.y,
                positions[idx + 2] - playerPosition.z
            );
            
            // Check if star is behind player
            const dotProduct = toStar.dot(forwardDirection);
            const distSq = toStar.lengthSq();
            
            // If star is behind player, add it to candidates for regeneration
            if (dotProduct < 0 || distSq > 1200*1200) {
                starIndices.push(i);
            }
        }
        
        // Shuffle array to pick random stars
        for (let i = starIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [starIndices[i], starIndices[j]] = [starIndices[j], starIndices[i]];
        }
        
        // Regenerate the selected stars ahead of player
        const regenerateCount = Math.min(starsToRegenerate, starIndices.length);
        for (let i = 0; i < regenerateCount; i++) {
            const starIdx = starIndices[i];
            const posIdx = starIdx * 3;
            
            // Generate position in a cone ahead of player
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 0.5); // Cone shape, mostly forward
            const radius = 300 + Math.random() * 300;
            
            // Base position on forward direction with randomness
            const dir = forwardDirection.clone();
            dir.x += (Math.random() - 0.5) * 0.6;
            dir.y += (Math.random() - 0.5) * 0.6;
            dir.z += (Math.random() - 0.5) * 0.6;
            dir.normalize();
            
            // Position ahead of player
            positions[posIdx] = playerPosition.x + dir.x * radius;
            positions[posIdx + 1] = playerPosition.y + dir.y * radius;
            positions[posIdx + 2] = playerPosition.z + dir.z * radius;
            
            // Assign new random speed
            if (this.starfield.speeds) {
                this.starfield.speeds[starIdx] = Math.random() * 2 + 0.5;
            }
        }
        
        // Update geometry
            this.starfield.geometry.attributes.position.needsUpdate = true;
    }
    
    // Method to reset a portion of stars while preserving others
    partialResetStars(playerPosition, forwardDirection) {
        if (!this.starfield || !this.starfield.geometry || 
            !this.starfield.geometry.attributes.position || !playerPosition) {
            return;
        }
        
        const positions = this.starfield.geometry.attributes.position.array;
        
        // Reset about 20% of stars, prioritizing those far from the player
        const totalStars = positions.length / 3;
        const starsToReset = Math.floor(totalStars * 0.2);
        
        // Calculate distances for all stars
        const starDistances = [];
        for (let i = 0; i < totalStars; i++) {
            const idx = i * 3;
            const dx = positions[idx] - playerPosition.x;
            const dy = positions[idx + 1] - playerPosition.y;
            const dz = positions[idx + 2] - playerPosition.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            
            // Check if behind player
            const toStar = new THREE.Vector3(dx, dy, dz);
            const dotProduct = toStar.dot(forwardDirection);
            
            starDistances.push({
                index: i,
                distSq: distSq,
                isBehind: dotProduct < 0
            });
        }
        
        // Sort by: first behind player, then by distance
        starDistances.sort((a, b) => {
            // First priority: stars behind player
            if (a.isBehind && !b.isBehind) return -1;
            if (!a.isBehind && b.isBehind) return 1;
            
            // Second priority: distance (farthest first)
            return b.distSq - a.distSq;
        });
        
        // Reset the selected stars
        for (let i = 0; i < starsToReset; i++) {
            const starIdx = starDistances[i].index;
            const posIdx = starIdx * 3;
            
            // Generate new position ahead of player
            const radius = 300 + Math.random() * 300;
            const dir = forwardDirection.clone();
            
            // Add some randomness but keep generally ahead
            dir.x += (Math.random() - 0.5) * 0.8;
            dir.y += (Math.random() - 0.5) * 0.8;
            dir.z += (Math.random() - 0.5) * 0.8;
            dir.normalize();
            
            // Position star ahead of player
            positions[posIdx] = playerPosition.x + dir.x * radius;
            positions[posIdx + 1] = playerPosition.y + dir.y * radius;
            positions[posIdx + 2] = playerPosition.z + dir.z * radius;
            
            // Assign new random speed
            if (this.starfield.speeds) {
                this.starfield.speeds[starIdx] = Math.random() * 2 + 0.5;
            }
        }
        
        // Update geometry
        this.starfield.geometry.attributes.position.needsUpdate = true;
    }

    setupNetworking(port) {
        this.network = new NetworkManager(this.gameState, port);
        
        this.network.on('connected', (playerId) => {
            console.log('Connected to server with ID:', playerId);
            
            // Don't enable join button in single player mode
            if (!this.network.singlePlayerMode) {
                document.getElementById('join-btn').disabled = false;
            }
            
            // Initialize asteroid system after network connection
            this.initAsteroidSystem();

            // Set initial camera position
            this.camera.position.set(0, 5, 15);
            this.camera.lookAt(0, 0, 0);
        });

        this.network.on('playersUpdated', (data) => {
            this.updatePlayerList(data.players);
            this.updatePlayerMeshes();
        });

        this.network.on('gameStarted', (state) => {
            this.gameState = state;
            document.getElementById('game-status').textContent = 'Game Started!';
            this.updatePlayerMeshes();
            
            // Reset difficulty and distance when game starts
            this.difficultyLevel = 1;
            if (this.localPlayer) {
                this.localPlayer.distanceTraveled = 0;
            }
        });

        this.network.on('gameStateUpdated', (state) => {
            this.updateGameState(state);
        });

        this.network.on('countdown', (data) => {
            console.log("Countdown event received:", data); // Debug log
            const seconds = Math.ceil(data.timeLeft / 1000);
            this.showCountdown(seconds);
        });

        this.network.on('powerupEffect', (data) => {
            // TODO: Show powerup effect
            console.log('Powerup effect:', data);
        });

        this.network.on('gameOver', (data) => {
            const winner = data.winner;
            document.getElementById('game-status').textContent = 
                `Game Over! Winner: ${winner ? winner.name : 'None'}`;
        });

        // Connect to server
        this.network.connect();
    }

    showCountdown(seconds) {
        // First, completely remove any existing countdown element
        const existingCountdown = document.getElementById('countdown-display');
        if (existingCountdown) {
            if (existingCountdown.parentNode) {
                existingCountdown.parentNode.removeChild(existingCountdown);
            }
        }
        
        // Create a new countdown display element
        const countdownDisplay = document.createElement('div');
        countdownDisplay.id = 'countdown-display';
        countdownDisplay.style.position = 'fixed';
        countdownDisplay.style.top = '50%';
        countdownDisplay.style.left = '50%';
        countdownDisplay.style.transform = 'translate(-50%, -50%)';
        countdownDisplay.style.color = '#00ff00';
        countdownDisplay.style.fontFamily = 'Arial, sans-serif';
        countdownDisplay.style.fontSize = '120px';
        countdownDisplay.style.fontWeight = 'bold';
        countdownDisplay.style.textShadow = '0 0 20px #00ff00';
        countdownDisplay.style.zIndex = '9999'; // Higher z-index to ensure visibility
        countdownDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        countdownDisplay.style.padding = '40px 80px';
        countdownDisplay.style.borderRadius = '20px';
        countdownDisplay.style.border = '3px solid #00ff00';
        document.body.appendChild(countdownDisplay);
        
        // Set initial countdown value
        countdownDisplay.textContent = seconds.toString();
        
        // Define a simple recursive countdown function
        const tickCountdown = (remaining) => {
            if (remaining > 0) {
                // Update text
                countdownDisplay.textContent = remaining.toString();
                
                // Continue countdown after 1 second
                setTimeout(() => tickCountdown(remaining - 1), 1000);
            } else {
                // Show "GO!" text
                countdownDisplay.textContent = "GO!";
                
                // Remove element after a short delay
                setTimeout(() => {
                    // Double-check the element still exists before removing
                    const element = document.getElementById('countdown-display');
                    if (element && element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                }, 1000);
            }
        };
        
        // Start countdown
        tickCountdown(seconds);
    }

    setupUI() {
        const joinBtn = document.getElementById('join-btn');
        const readyBtn = document.getElementById('ready-btn');
        const startBtn = document.getElementById('start-btn');
        const singlePlayerBtn = document.getElementById('single-player-btn');
        const playerNameInput = document.getElementById('player-name');

        console.log('Setting up UI buttons:', {
            joinBtn: joinBtn ? 'found' : 'missing',
            readyBtn: readyBtn ? 'found' : 'missing',
            startBtn: startBtn ? 'found' : 'missing',
            singlePlayerBtn: singlePlayerBtn ? 'found' : 'missing',
            playerNameInput: playerNameInput ? 'found' : 'missing'
        });

        // Setup keyboard controls - VERY IMPORTANT! Do this before button setup
        console.log('Setting up keyboard controls');
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Ensure player controls are enabled
        this.controls.up = false;
        this.controls.down = false;
        this.controls.left = false;
        this.controls.right = false;
        this.controls.boost = false;

        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                const playerName = playerNameInput.value.trim();
                console.log('Join button clicked, name:', playerName);
                if (playerName) {
                    this.network.joinLobby(playerName);
                    joinBtn.disabled = true;
                    readyBtn.disabled = false;
                    singlePlayerBtn.disabled = true;
                    playerNameInput.disabled = true;
                    console.log('Ready button enabled');
                }
            });
        }
        
        if (readyBtn) {
            readyBtn.addEventListener('click', () => {
                console.log('Ready button clicked');
                this.network.setReady();
                readyBtn.disabled = true;
                startBtn.disabled = false;
                console.log('Start button enabled');
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.network.startGame();
                startBtn.disabled = true;
            });
        }

        // Add single player mode
        if (singlePlayerBtn) {
            singlePlayerBtn.addEventListener('click', () => {
                const playerName = playerNameInput.value.trim() || 'Player';
                console.log('Single player mode selected, name:', playerName);
                
                // Disable buttons
                if (joinBtn) joinBtn.disabled = true;
                if (readyBtn) readyBtn.disabled = true;
                if (startBtn) startBtn.disabled = true;
                if (singlePlayerBtn) singlePlayerBtn.disabled = true;
                if (playerNameInput) playerNameInput.disabled = true;
                
                // Set up single player mode
                this.singlePlayerMode = true;
                
                // Create the player entry with the 'local-player' ID
                this.gameState.players = {
                'local-player': {
                    id: 'local-player',
                        name: playerName,
                    ready: true,
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    health: 100,
                    score: 0
                }
                };
                
                // Create a basic network stub with the local-player ID
                this.network = {
                    playerId: 'local-player',
                    singlePlayerMode: true,
                    on: () => {}, // Empty event handler
                    connect: () => {}, // Empty connect method
                    updatePlayer: () => {}, // Empty update method
                    shoot: () => {}, // Empty shoot method
                    gameOver: () => {} // Empty game over method
                };
                
                // Initialize player reference
                this.localPlayer = this.gameState.players['local-player'];
                
                // Set game status
                const gameStatus = document.getElementById('game-status');
                if (gameStatus) gameStatus.textContent = 'Single Player Mode';
                
                // Update player list UI
                this.updatePlayerList(this.gameState.players);
                
                // Create player mesh and initialize asteroid system
                this.updatePlayerMeshes();
                if (!this.asteroidPool) {
            this.initAsteroidSystem();
        }
        
                // Add a slight delay before starting
                setTimeout(() => {
                    console.log('Starting single player game');
                    
                    // Show countdown
                    this.showCountdown(3);
                    
                    // Start the game after countdown
                    setTimeout(() => {
                        this.gameState.isRunning = true;
                        
                        // Initialize difficulty for single player
                        this.difficultyLevel = 1;
                        
                        // Create initial wave of asteroids
                        for (let i = 0; i < 10; i++) {
            this.spawnAsteroid(true);
        }
                        
                    }, 3000);
                }, 500);
            });
        }
        
        // Mouse controls have been disabled
        // document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    }

    handleKeyUp(event) {
        if (!this.gameState.isRunning || !this.localPlayer) return;

        // Only process the event if it exists and has a key property
        if (!event || !event.key) return;

        switch (event.key.toLowerCase()) {
            case 'w':
                this.controls.up = false;
                break;
            case 's':
                this.controls.down = false;
                break;
            case 'a':
                this.controls.left = false;
                break;
            case 'd':
                this.controls.right = false;
                break;
            case 'shift':
                this.controls.boost = false;
                break;
        }
    }

    handleMouseMove(event) {
        if (!this.gameState.isRunning || !this.localPlayer || !this.controls.mouseEnabled) return;
        
        // Calculate mouse position relative to the center of the screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Normalize coordinates (-1 to 1)
        const normalizedX = (event.clientX - centerX) / (window.innerWidth / 2);
        const normalizedY = (event.clientY - centerY) / (window.innerHeight / 2);
        
        // Update mouse position
        this.controls.mousePosition.set(normalizedX, -normalizedY); // Invert Y axis
    }

    updatePlayerList(players) {
        const playerList = document.getElementById('player-list');
        playerList.innerHTML = '';
        
        Object.values(players).forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.textContent = `${player.name} ${player.ready ? '(Ready)' : ''}`;
            if (player.id === this.network.playerId) {
                playerItem.style.color = '#4CAF50';
                this.localPlayer = player;
            }
            playerList.appendChild(playerItem);
        });
    }

    createPlayerMesh() {
        console.log('Creating player mesh...');
        const shipGroup = new THREE.Group();
        
        try {
            // Use one of the loaded ship models
            if (this.models.ships && this.models.ships.length > 0) {
                console.log('Creating player with loaded ship model');
                const shipModel = this.models.ships[Math.floor(Math.random() * this.models.ships.length)].clone();
                
                // Ensure proper orientation and scale
                shipModel.rotation.set(0, Math.PI, 0); // Face forward
                shipModel.scale.set(1, 1, 1); // Reset scale as it's already set during loading
                shipGroup.add(shipModel);
                
                // Add engine glow
                const engineGlow = new THREE.PointLight(0x00ffff, 1, 5);
                engineGlow.position.set(0, 0, 2); // Move to back of ship
                shipGroup.add(engineGlow);
                
                console.log('Successfully created ship mesh from loaded model');
                return shipGroup;
            } else {
                console.log('No ship models loaded, creating basic ship mesh');
                // Create a basic ship mesh as fallback
                return this.createBasicShipMesh();
            }
        } catch (err) {
            console.error('Error creating player mesh from loaded model:', err);
            console.log('Falling back to basic ship mesh');
            return this.createBasicShipMesh();
        }
    }
    
    createBasicShipMesh() {
        console.log('Creating basic ship mesh...');
        // Original basic ship mesh code as fallback
        const shipGroup = new THREE.Group();
        
        try {
        const bodyGeometry = new THREE.ConeGeometry(1, 3, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({
                color: 0x3366ff,
            shininess: 100,
            specular: 0x111111
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.rotation.x = Math.PI / 2;
        shipGroup.add(body);
        
            const wingGeometry = new THREE.BoxGeometry(4, 0.2, 2);
        const wingMaterial = new THREE.MeshPhongMaterial({
                color: 0x2255dd,
            shininess: 100,
            specular: 0x111111
        });
            const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
            leftWing.position.set(-1, 0, -1);
            const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
            rightWing.position.set(1, 0, -1);
            shipGroup.add(leftWing);
            shipGroup.add(rightWing);

            const engineGlow = new THREE.PointLight(0x00ffff, 1, 5);
            engineGlow.position.set(0, 0, -2);
            shipGroup.add(engineGlow);
            
            console.log('Successfully created basic ship mesh');
        return shipGroup;
        } catch (err) {
            console.error('Error creating basic ship mesh:', err);
            // Last resort fallback - create the most basic mesh possible
            const fallbackGroup = new THREE.Group();
            const fallbackGeometry = new THREE.BoxGeometry(1, 1, 3);
            const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
            const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            fallbackGroup.add(fallbackMesh);
            return fallbackGroup;
        }
    }

    updatePlayerMeshes() {
        // This method is crucial for creating player meshes

        // For single player mode, ensure we have a local-player mesh
        if (this.singlePlayerMode) {
            if (!this.playerMeshes.has('local-player')) {
                console.log('Creating player mesh for single player mode');
                
                // Use a loaded ship model instead of the basic ship
                const mesh = this.createPlayerMesh(); // Changed from createBasicShipMesh to createPlayerMesh
                
                this.playerMeshes.set('local-player', mesh);
                this.scene.add(mesh);
                
                // Ensure we have player data
                if (!this.gameState.players['local-player']) {
                    this.gameState.players['local-player'] = {
                        id: 'local-player',
                        name: 'Player',
                        ready: true,
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        health: 100,
                        score: 0
                    };
                }
                
                // Make sure local player references the right player
                this.localPlayer = this.gameState.players['local-player'];
                console.log('Player mesh created for single player');
            }
            return; // Don't continue with normal multiplayer logic
        }
        
        // Normal multiplayer logic below
        // Remove old meshes for players no longer in the game state
        this.playerMeshes.forEach((mesh, id) => {
            if (!this.gameState.players[id]) {
                this.scene.remove(mesh);
                this.playerMeshes.delete(id);
            }
        });

        // Create new meshes for all players
        Object.values(this.gameState.players).forEach(player => {
            if (!this.playerMeshes.has(player.id)) {
                const mesh = this.createPlayerMesh();
                this.playerMeshes.set(player.id, mesh);
                this.scene.add(mesh);
                
                // Initialize health for local player
                if (player.id === this.network.playerId) {
                    if (!this.localPlayer) {
                        this.localPlayer = player;
                    }
                    if (!this.localPlayer.health) {
                        this.localPlayer.health = 100;
                    }
                }
            }
        });
    }

    updateGameState(state) {
        // Update player positions
        Object.entries(state.players).forEach(([id, player]) => {
            const mesh = this.playerMeshes.get(id);
            if (mesh) {
                if (id === this.network.playerId) {
                    // Local player's health and position are handled in updateMovement
                    this.localPlayer.health = player.health || this.localPlayer.health;
                } else {
                    // For other players, update their positions and rotations
                    mesh.position.copy(player.position);
                    mesh.rotation.x = player.rotation.x;
                    mesh.rotation.y = player.rotation.y;
                    mesh.rotation.z = player.rotation.z;
                    mesh.rotation.order = 'XYZ';
                    
                    // Make other players more visible
                    mesh.scale.set(1, 1, 1);
                    
                    // Enhanced visibility for other players
                    if (!mesh.userData.aura) {
                        // Add bright aura
                        const aura = new THREE.PointLight(0x00ff00, 3, 30);
                        mesh.add(aura);
                        
                        // Add emissive material to ship
                        mesh.traverse((child) => {
                            if (child.isMesh) {
                                child.material.emissive = new THREE.Color(0x00ff00);
                                child.material.emissiveIntensity = 0.5;
                            }
                        });
                        
                        mesh.userData.aura = aura;
                    }
                }
            } else if (id !== this.network.playerId) {
                // Create mesh for new player if it doesn't exist
                const newMesh = this.createPlayerMesh();
                this.playerMeshes.set(id, newMesh);
                this.scene.add(newMesh);
            }
        });

        // Update health display
        const healthDisplay = document.getElementById('health-display') || this.createHealthDisplay();
        healthDisplay.textContent = `Health: ${Math.round(this.localPlayer.health)}%`;

        // Update asteroids with minimal effects
        if (state.asteroids) {
            state.asteroids.forEach((asteroidData, index) => {
                if (index < this.asteroidPool.length) {
                    const asteroid = this.asteroidPool[index];
                    if (asteroidData.active && !asteroid.active) {
                        asteroid.mesh.visible = true;
                        asteroid.active = true;
                        // Minimal glow effect
                        if (!asteroid.mesh.userData.glow) {
                            const glow = new THREE.PointLight(0xff4500, 0.2, 2);
                            asteroid.mesh.add(glow);
                            asteroid.mesh.userData.glow = glow;
                        }
                    } else if (!asteroidData.active && asteroid.active) {
                        asteroid.mesh.visible = false;
                        asteroid.active = false;
                    }
                    if (asteroid.active) {
                        asteroid.mesh.position.copy(asteroidData.position);
                        asteroid.mesh.rotation.copy(asteroidData.rotation);
                        asteroid.velocity.copy(asteroidData.velocity);
                    }
                }
            });
        }
    }

    createHealthDisplay() {
        // Remove existing health display if it exists
        const existingDisplay = document.getElementById('health-display');
        if (existingDisplay) {
            existingDisplay.remove();
        }

        const display = document.createElement('div');
        display.id = 'health-display';
        display.style.position = 'fixed';
        display.style.top = '60px';
        display.style.right = '20px';
        display.style.color = '#00ff00'; // Bright green for better visibility
        display.style.fontFamily = 'Arial, sans-serif';
        display.style.fontSize = '28px'; // Even larger
        display.style.padding = '15px'; // Larger padding
        display.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // More opaque background
        display.style.borderRadius = '8px';
        display.style.zIndex = '1000';
        display.style.border = '2px solid #00ff00'; // Add border for better visibility
        display.style.textShadow = '0 0 5px #00ff00'; // Add glow effect
        display.textContent = `Health: ${this.localPlayer.health}%`;
        document.body.appendChild(display);
        return display;
    }

    spawnEnemyShip() {
        if (this.models.enemies.length === 0) return;

        const enemyModel = this.models.enemies[0].clone();
        const radius = 200;
        const angle = Math.random() * Math.PI * 2;
        
        // Position enemy ship at random point on circle around play area
        enemyModel.position.set(
            radius * Math.cos(angle),
            (Math.random() - 0.5) * 50, // Random height
            radius * Math.sin(angle)
        );
        
        // Make enemy face center
        enemyModel.lookAt(0, 0, 0);
        
        // Add to scene
        this.scene.add(enemyModel);
        
        // Add to game state
        const enemy = {
            id: 'enemy_' + Date.now(),
            model: enemyModel,
            health: 100,
            speed: 0.3,
            position: enemyModel.position,
            rotation: enemyModel.rotation
        };
        
        this.gameState.enemies.push(enemy);
        
        return enemy;
    }

    createProjectile(position, direction) {
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Create light for projectile glow
        const light = new THREE.PointLight(0x00ff00, 1, 10);
        mesh.add(light);
        
        // Set velocity based on direction
        const speed = 2;
        const velocity = direction.normalize().multiplyScalar(speed);
        
        const projectile = {
            id: 'projectile_' + Date.now(),
            mesh,
            velocity,
            timeCreated: Date.now()
        };
        
        this.scene.add(mesh);
        this.projectiles.add(projectile);
        
        // Remove projectile after 2 seconds
        setTimeout(() => {
            this.scene.remove(mesh);
            this.projectiles.delete(projectile);
        }, 2000);
        
        return projectile;
    }

    checkCollisions() {
        // Check projectile collisions with enemies
        this.projectiles.forEach(projectile => {
            this.gameState.enemies.forEach((enemy, index) => {
                if (!enemy.model) return;
                
                const distance = projectile.mesh.position.distanceTo(enemy.model.position);
                if (distance < 3) { // Collision radius
                    // Remove projectile
                    this.scene.remove(projectile.mesh);
                    this.projectiles.delete(projectile);
                    
                    // Damage enemy
                    enemy.health -= 25;
                    if (enemy.health <= 0) {
                        // Destroy enemy
                        this.scene.remove(enemy.model);
                        this.gameState.enemies.splice(index, 1);
                        
                        // Create explosion effect
                        this.createExplosion(enemy.model.position);
                        
                        // Notify server
                        this.network.enemyDestroyed(enemy.id);
                    }
                }
            });
        });
    }

    createExplosion(position) {
        const particleCount = 30;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        const colors = [];
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ));
            
            colors.push(new THREE.Color(
                Math.random() < 0.5 ? 0xff4500 : 0xffd700
            ));
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(
            colors.flatMap(color => [color.r, color.g, color.b]),
            3
        ));
        
        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        // Animate explosion
        let frame = 0;
        const animate = () => {
            frame++;
            const positions = particles.geometry.attributes.position.array;
            
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] += velocities[i].x;
                positions[i * 3 + 1] += velocities[i].y;
                positions[i * 3 + 2] += velocities[i].z;
            }
            
            particles.geometry.attributes.position.needsUpdate = true;
            material.opacity = 1 - (frame / 60);
            
            if (frame < 60) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(particles);
            }
        };
        
        animate();
    }

    animate() {
            requestAnimationFrame(() => this.animate());

        // Check if the player is eliminated (game over)
        const isGameOver = this.localPlayer && this.localPlayer.eliminated;
        
        // Always update movement for camera controls, but with reduced functionality if game over
            this.updateMovement();

        // Always update distance based on time (unless game over)
        if (!isGameOver) {
            this.updateDistanceBasedOnTime();
        }

        // ALWAYS update starfield regardless of game state for visual continuity
                    this.updateStarfield();
        
        // Only update game elements if the game is running and not game over
        if (this.gameState.isRunning && !isGameOver) {
            // Update asteroids
            this.updateAsteroids();
            
            // IMPROVED ASTEROID DENSITY MANAGEMENT
            // Get player speed
            let playerSpeed = 1.0;
            if (this.controls && this.controls.baseSpeed) {
                playerSpeed = this.controls.baseSpeed;
            }
            
            // Ensure difficulty level is initialized
            if (!this.difficultyLevel) {
                this.difficultyLevel = 1;
            }
            
            // Calculate minimum asteroid count based on player speed - INCREASED
            const minBaseCount = 25; // Increased from 20
            const speedBonusCount = Math.floor(playerSpeed * 3); // Increased from 2
            const difficultyBonusCount = this.difficultyLevel * 3; // Increased from 2
            
            // More asteroids at higher distances
            const distanceBonus = Math.floor(this.localPlayer.distanceTraveled / 1000) * 5;
            
            // Ensure this many asteroids are always present
            const guaranteedCount = minBaseCount + speedBonusCount + difficultyBonusCount + distanceBonus;
            
            // Track how many asteroids are active
            const activeCount = this.asteroids ? this.asteroids.length : 0;
            
            // Calculate hunter asteroid limit - more hunters at higher difficulties
            const maxHunterCount = Math.min(5, Math.floor(this.difficultyLevel / 2) + 1);
            
            // Count current hunter asteroids
            let hunterCount = 0;
            if (this.asteroids) {
                hunterCount = this.asteroids.filter(ast => ast.isHunter).length;
            }
            
            // Always maintain a minimum number of asteroids
            if (activeCount < guaranteedCount) {
                // Calculate how many to spawn this frame - INCREASE for faster spawning
                const neededCount = guaranteedCount - activeCount;
                const spawnThisFrame = Math.min(4, neededCount); // Up to 4 per frame (increased from 3)
                
                // Reduce logging to avoid console spam
                if (Math.random() < 0.2) {
                    console.log(`Spawning ${spawnThisFrame} asteroids (currently have ${activeCount}/${guaranteedCount})`);
                }
                
                // Spawn asteroids with a mix of types
                for (let i = 0; i < spawnThisFrame; i++) {
                    let asteroid;
                    
                    // Decide if we should try to spawn a hunter
                    const needMoreHunters = hunterCount < maxHunterCount;
                    const shouldSpawnHunter = needMoreHunters && Math.random() < 0.2; // 20% chance when possible
                    
                    if (shouldSpawnHunter) {
                        // Force a hunter asteroid - will be handled in spawnAsteroid based on chance
                        asteroid = this.spawnAsteroid(false);
                        hunterCount++;
                    } else {
                        // 60% chance to spawn directly in player's path for standard asteroids
                        const inPath = Math.random() < 0.6;
                        asteroid = this.spawnAsteroid(!inPath);
                    }
                    
                    // Force a spawn in a clearly visible location if spawning failed
                    if (!asteroid && i === 0) {
                        // Create a fallback spawn at a very visible position
                        this.spawnEmergencyAsteroid();
                    }
                }
            }

            // Update projectiles
            this.projectiles.forEach(projectile => {
                projectile.mesh.position.add(projectile.velocity);
            });

            // Update enemies
                        this.gameState.enemies.forEach(enemy => {
                if (!enemy.model) return;
                            
                            // Move towards center
                            const direction = new THREE.Vector3();
                            direction.subVectors(new THREE.Vector3(0, 0, 0), enemy.model.position);
                            direction.normalize();
                            
                            enemy.model.position.add(direction.multiplyScalar(enemy.speed));
                            enemy.model.lookAt(0, 0, 0);
                        });

            // Spawn new enemies periodically
                    if (Math.random() < 0.005) {
                        this.spawnEnemyShip();
                }

                // Check for collisions
                    this.checkCollisions();
            
            // Periodically clean up distant asteroids to maintain performance
            if (Math.random() < 0.05) { // ~3 times per second
                this.cleanupAsteroids();
            }
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    async loadModels() {
        const loader = new GLTFLoader();

        try {
            console.log('Loading ship models...');
            // Load ships (keeping the existing ship loading approach)
            const shipPaths = [
                './models/ships/cruiser.glb',
                './models/ships/fighter.glb'
            ];
            
            // Try to load ship models but use basic models as fallback
            try {
                this.models.ships = await Promise.all(
                    shipPaths.map(path => this.loadSingleModel(loader, path))
                ).then(models => models.filter(model => model !== null));
                
                console.log(`Loaded ${this.models.ships.length} ship models`);
        } catch (error) {
                console.warn('Failed to load ship models, using fallback:', error);
                this.models.ships = [];
            }
            
            // Try to load asteroid models from the specified files
            console.log('Loading asteroid models...');
            try {
                // First try smallasteroid.glb, if that fails try asteroid1.glb
                let asteroidsGLB = await this.loadSingleModel(loader, './models/asteroids/smallasteroid.glb');
                
                if (!asteroidsGLB) {
                    console.log('Trying alternative asteroid model...');
                    asteroidsGLB = await this.loadSingleModel(loader, './models/asteroids/asteroid1.glb');
                }
                
                if (asteroidsGLB) {
                    // Extract all meshes from the loaded model - these are our individual asteroid variants
                    this.models.asteroids = [];
                    asteroidsGLB.traverse(child => {
                        // Look for actual meshes (asteroid models) within the loaded GLB
                        if (child.isMesh || (child.isGroup && child.children.some(c => c.isMesh))) {
                            console.log(`Found asteroid variant: ${child.name}`);
                            // Clone to avoid reference issues
                            const asteroidVariant = child.clone();
                            this.models.asteroids.push(asteroidVariant);
                        }
                    });
                    
                    console.log(`Extracted ${this.models.asteroids.length} asteroid models from GLB`);
                }
            } catch (error) {
                console.error('Failed to load asteroid GLB files:', error);
            }
            
            // If no asteroid models were found, create basic ones as fallback
            if (!this.models.asteroids || this.models.asteroids.length === 0) {
                console.log('No asteroid models found, using basic asteroid models');
                this.createBasicAsteroidModels();
            }

            // Continue with other model types as before...
            
        } catch (error) {
            console.error('Error loading models:', error);
            // Create basic models as fallback
            this.createBasicModels();
        }
    }

    loadSingleModel(loader, path) {
        console.log(`Attempting to load model from path: ${path}`);
        
        return new Promise((resolve, reject) => {
            try {
                loader.load(
                    path,
                    (gltf) => {
                        const model = gltf.scene;
                        model.scale.set(0.5, 0.5, 0.5);
                        model.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                if (child.material) {
                                    child.material.metalness = 0.5;
                                    child.material.roughness = 0.5;
                                    child.material.needsUpdate = true;
                                }
                            }
                        });
                        console.log(`Successfully loaded model: ${path}`);
                        resolve(model);
                    },
                    (progress) => {
                        console.log(`Loading ${path}:`, (progress.loaded / progress.total * 100) + '%');
                    },
                    (error) => {
                        console.warn(`Failed to load model ${path}:`, error);
                        resolve(null); // Resolve with null instead of rejecting
                    }
                );
            } catch (err) {
                console.error(`Error initiating load for ${path}:`, err);
                resolve(null);
            }
        });
    }

    updateCameraZoom() {
        if (!this.camera || !this.localPlayer) return;
        
        // Get player mesh using the same pattern as updateMovement
        let playerId = null;
        if (this.singlePlayerMode) {
            playerId = 'local-player';
        } else if (this.network && this.network.playerId) {
            playerId = this.network.playerId;
        }
        
        if (!playerId) return;
        
        const playerMesh = this.playerMeshes.get(playerId);
        if (!playerMesh) return;

        // Remove camera from ship if it's a child
        if (this.camera.parent === playerMesh) {
            const worldPosition = this.camera.getWorldPosition(new THREE.Vector3());
            const worldQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
            playerMesh.remove(this.camera);
            this.scene.add(this.camera);
            this.camera.position.copy(worldPosition);
            this.camera.quaternion.copy(worldQuaternion);
        }

        // Calculate desired camera position
        const cameraOffset = new THREE.Vector3(
            0,
            this.cameraSettings.height,
            this.cameraSettings.currentZoom
        );
        
        // Get ship's world position
        const shipPosition = playerMesh.getWorldPosition(new THREE.Vector3());
        
        // Calculate camera target position (behind and above ship)
        const targetPosition = shipPosition.clone();
        cameraOffset.applyQuaternion(playerMesh.quaternion);
        targetPosition.add(cameraOffset);
        
        // Smoothly move camera to target position
        this.camera.position.lerp(targetPosition, 0.1);
        
        // Calculate look target (ahead of ship)
        const lookAhead = new THREE.Vector3(0, 0, -this.cameraSettings.lookAheadDistance);
        lookAhead.applyQuaternion(playerMesh.quaternion);
        const lookTarget = shipPosition.clone().add(lookAhead);
        
        // Make camera look at target point
        this.camera.lookAt(lookTarget);
    }

    updateDifficulty() {
        // Only update difficulty periodically
        const now = Date.now();
        if (now - this.lastDifficultyUpdate < this.difficultyUpdateInterval) return;
        this.lastDifficultyUpdate = now;
        
        // Skip if no distance tracked yet
        if (!this.distanceTraveled || this.distanceTraveled <= 0) return;
        
        // Increase difficulty more rapidly - every 300 units instead of 500
        const newDifficultyLevel = 1 + Math.floor(this.distanceTraveled / 300);
        
        if (newDifficultyLevel > this.difficultyLevel) {
            const oldLevel = this.difficultyLevel;
            this.difficultyLevel = newDifficultyLevel;
            
            console.log(`DIFFICULTY INCREASED: Level ${oldLevel} → ${this.difficultyLevel}`);
            console.log(`Distance traveled: ${Math.round(this.distanceTraveled)}`);
            
            // Update wave configuration based on difficulty - more aggressive scaling
            this.waveConfig.minAsteroidsPerWave = Math.min(5 + Math.floor(this.difficultyLevel / 2), 12);
            this.waveConfig.maxAsteroidsPerWave = Math.min(10 + Math.floor(this.difficultyLevel / 2), 20);
            
            // Reduce delay between waves as difficulty increases - more aggressive
            const delayReduction = Math.min(this.difficultyLevel * 250, 2500);
            this.waveConfig.minWaveDelay = Math.max(3000 - delayReduction, 800);
            this.waveConfig.maxWaveDelay = Math.max(6000 - delayReduction, 1500);
            
            // Show difficulty increase notification
            this.showDifficultyNotification(this.difficultyLevel);
        }
    }

    showSpeedUpNotification(percentIncrease) {
        // Log the speed increase but don't show any visual notification
        console.log(`SPEED INCREASE: +${percentIncrease}% speed increase`);
        // Function intentionally does nothing visual now
    }

    showDifficultyNotification(level) {
        // Log the difficulty increase but don't show any visual notification
        console.log(`DIFFICULTY INCREASE: Level ${level}`);
        // Function intentionally does nothing visual now
    }

    // Helper method to check if a position is within defined boundaries
    isWithinBoundaries(position) {
        // Always return true to disable boundaries
        return true;
    }
    
    // Also remove the boundary indicator
    updateBoundaryIndicator(position) {
        // This method is empty to disable boundary indicators
        return;
    }

    createBasicAsteroidModels() {
        console.log('Creating basic asteroid models as fallback');
        
        // Use our imported asteroid generator
        const asteroidGroup = createAsteroidGroup(THREE, 5);
        this.models.asteroids = [];
        
        // Extract individual meshes from the group
        asteroidGroup.children.forEach(asteroid => {
            this.models.asteroids.push(asteroid);
        });
        
        // Add a few more variants with different sizes
        for (let i = 0; i < 3; i++) {
            const size = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
            const variant = createBasicAsteroid(THREE, size, i + 3);
            this.models.asteroids.push(variant);
        }
        
        console.log(`Created ${this.models.asteroids.length} basic asteroid models`);
    }

    // Implement LOD (Level of Detail) for distant objects
    setupLOD() {
        // Create a LOD manager for asteroids
        this.asteroidLODs = {};
        
        // Set up LOD distances
        this.lodLevels = {
            high: 0,     // High detail (original model)
            medium: 200, // Medium detail (simplified model)
            low: 500,    // Low detail (very simplified)
            ultra_low: 1000 // Ultra low detail (simple box)
        };
        
        // Create simplified models for each LOD level
        this.lodModels = {
            high: null,    // Will use the original asteroid models
            medium: null,  // Will be set to a medium-detail version
            low: null,     // Will be set to a low-detail version
            ultra_low: new THREE.BoxGeometry(10, 10, 10) // Simple box geometry
        };
        
        // Create materials for each LOD level
        this.lodMaterials = {
            high: null,    // Will use the original materials
            medium: null,  // Similar to original but simplified
            low: new THREE.MeshLambertMaterial({ color: 0x888888 }),
            ultra_low: new THREE.MeshBasicMaterial({ color: 0x666666 })
        };
    }

    // Helper method to calculate distance to player
    getDistanceToPlayer(position) {
        if (!this.network) return Infinity;
        
        // For single player mode, handle the special playerId format
        const playerId = this.singlePlayerMode ? 'local-player' : (this.network.playerId);
        if (!playerId) return Infinity;
        
        const playerMesh = this.playerMeshes.get(playerId);
        if (!playerMesh) return Infinity;
        
        // Make sure both position and playerMesh.position are defined before calling distanceTo
        if (!position || !playerMesh.position) return Infinity;
        
        return position.distanceTo(playerMesh.position);
    }

    // Update the asteroid with LOD based on distance
    updateAsteroidLOD(asteroid) {
        // Skip if asteroid or its position is undefined
        if (!asteroid || !asteroid.mesh || !asteroid.mesh.position) return;
        
        // Make sure this.lodLevels is properly initialized
        if (!this.lodLevels) {
            // If for some reason lodLevels is not initialized, set up default values
            this.lodLevels = {
                high: 0,     // High detail (original model)
                medium: 200, // Medium detail (simplified model)
                low: 500,    // Low detail (very simplified)
                ultra_low: 1000 // Ultra low detail (simple box)
            };
            console.warn('LOD levels were not properly initialized, using defaults');
        }
        
        const distanceToPlayer = this.getDistanceToPlayer(asteroid.mesh.position);
        
        // Determine appropriate LOD level with safety checks
        let currentLevel = 'high';
        
        if (this.lodLevels.ultra_low && distanceToPlayer > this.lodLevels.ultra_low) {
            currentLevel = 'ultra_low';
        } else if (this.lodLevels.low && distanceToPlayer > this.lodLevels.low) {
            currentLevel = 'low';
        } else if (this.lodLevels.medium && distanceToPlayer > this.lodLevels.medium) {
            currentLevel = 'medium';
        }
        
        // If asteroid mesh doesn't have userData, initialize it
        if (!asteroid.mesh.userData) {
            asteroid.mesh.userData = {};
        }
        
        // If asteroid doesn't have an ID, assign one
        if (!asteroid.mesh.userData.id) {
            asteroid.mesh.userData.id = 'asteroid_' + Math.random().toString(36).substr(2, 9);
        }
        
        const id = asteroid.mesh.userData.id;
        
        // Initialize asteroidLODs if not defined
        if (!this.asteroidLODs) {
            this.asteroidLODs = {};
        }
        
        // Initialize lodModels if not defined
        if (!this.lodModels) {
            this.lodModels = {
                high: null,
                medium: null, 
                low: null,
                ultra_low: new THREE.BoxGeometry(10, 10, 10)
            };
        }
        
        // If LOD needs to change
        if (!asteroid.mesh.userData.currentLOD || asteroid.mesh.userData.currentLOD !== currentLevel) {
            asteroid.mesh.userData.currentLOD = currentLevel;
            
            // Update the asteroid geometry for ultra_low and low LOD levels
            if (currentLevel === 'ultra_low' || currentLevel === 'low') {
                // If we haven't created an LOD model for this asteroid yet
                if (!this.asteroidLODs[id]) {
                    this.asteroidLODs[id] = {};
                }
                
                // If we haven't created this LOD level for this asteroid yet
                if (!this.asteroidLODs[id][currentLevel]) {
                        // Create a simplified version for this LOD level
                    let geometry;
                    
                    if (currentLevel === 'ultra_low' && this.lodModels.ultra_low) {
                        geometry = this.lodModels.ultra_low.clone();
                    } else if (asteroid.mesh.geometry) {
                        geometry = this.simplifyGeometry(asteroid.mesh.geometry);
                    } else {
                        // Fallback to a simple sphere if geometry is missing
                        geometry = new THREE.SphereGeometry(1, 4, 4);
                    }
                            
                        const material = currentLevel === 'ultra_low' ? 
                            this.lodMaterials.ultra_low : 
                            this.lodMaterials.low;
                            
                        // Store original geometry and material for future reference
                    if (!asteroid.mesh.userData.originalGeometry && asteroid.mesh.geometry) {
                            asteroid.mesh.userData.originalGeometry = asteroid.mesh.geometry;
                            asteroid.mesh.userData.originalMaterial = asteroid.mesh.material;
                        }
                        
                        // Store the new geometry and material for this LOD level
                        this.asteroidLODs[id][currentLevel] = {
                            geometry: geometry,
                            material: material
                        };
                }
                
                    // Apply the LOD geometry and material
                if (this.asteroidLODs[id][currentLevel]) {
                    asteroid.mesh.geometry = this.asteroidLODs[id][currentLevel].geometry;
                    asteroid.mesh.material = this.asteroidLODs[id][currentLevel].material;
                }
            } else {
                // Restore original geometry and material for higher LOD levels
                if (asteroid.mesh.userData.originalGeometry) {
                    asteroid.mesh.geometry = asteroid.mesh.userData.originalGeometry;
                    asteroid.mesh.material = asteroid.mesh.userData.originalMaterial;
                }
            }
        }
    }

    // Helper function to simplify geometry for lower LOD levels
    simplifyGeometry(geometry) {
        // Create a simpler geometry with fewer vertices
        // This is a placeholder - in a real game, you'd use a proper geometry simplification algorithm
        const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
        const size = new THREE.Vector3();
        box.getSize(size);
        
        // Create a simplified geometry based on the size of the original
        return new THREE.SphereGeometry(
            Math.max(size.x, size.y, size.z) / 2 * 0.8, // 80% of the bounding sphere
            8,  // reduced radial segments
            6   // reduced height segments
        );
    }

    // Update the update method to show speed tracker
    update(dt) {
        // ... existing code ...
        
        // Update speed tracker display
        if (this.player) {
            const speed = Math.sqrt(
                this.playerVelocity.x * this.playerVelocity.x + 
                this.playerVelocity.y * this.playerVelocity.y +
                this.playerVelocity.z * this.playerVelocity.z
            );
            
            const speedKmh = Math.round(speed * 3.6 * 100); // Convert to km/h (assuming units are in meters)
            this.speedTracker.innerHTML = `
                <div>Speed: ${speedKmh} km/h</div>
                <div>Health: ${this.playerHealth}%</div>
                <div>Score: ${this.score}</div>
            `;
        }
        
        // ... existing code ...
    }

    // Update the network code to send only changed data
    updateNetwork() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        // Check if position has changed significantly enough to send an update
        const posThreshold = 0.5; // Only send if position changed by 0.5 units or more
        const rotThreshold = 0.05; // Only send if rotation changed by 0.05 radians or more
        
        const posChanged = 
            !this.lastSentPosition || 
            Math.abs(this.player.position.x - this.lastSentPosition.x) > posThreshold ||
            Math.abs(this.player.position.y - this.lastSentPosition.y) > posThreshold ||
            Math.abs(this.player.position.z - this.lastSentPosition.z) > posThreshold;
        
        const rotChanged = 
            !this.lastSentRotation || 
            Math.abs(this.player.rotation.x - this.lastSentRotation.x) > rotThreshold ||
            Math.abs(this.player.rotation.y - this.lastSentRotation.y) > rotThreshold ||
            Math.abs(this.player.rotation.z - this.lastSentRotation.z) > rotThreshold;
        
        const healthChanged = this.lastSentHealth !== this.playerHealth;
        const scoreChanged = this.lastSentScore !== this.score;
        
        // Only send update if something relevant changed
        if (posChanged || rotChanged || healthChanged || scoreChanged) {
            this.lastSentPosition = this.player.position.clone();
            this.lastSentRotation = this.player.rotation.clone();
            this.lastSentHealth = this.playerHealth;
            this.lastSentScore = this.score;
            
            // Send only the data that changed
            const updateData = {
                type: 'update',
                health: this.playerHealth,
                score: this.score
            };
            
            if (posChanged) {
                updateData.position = {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    z: this.player.position.z
                };
            }
            
            if (rotChanged) {
                updateData.rotation = {
                    x: this.player.rotation.x,
                    y: this.player.rotation.y,
                    z: this.player.rotation.z
                };
            }
            
            this.ws.send(JSON.stringify(updateData));
        }
    }

    // New method to handle speed increases based on distance traveled
    updateSpeedBasedOnDistance() {
        // Get distance traveled - ensure it's defined
        const distance = this.localPlayer?.distanceTraveled || 0;
        
        // Check if we need to initialize the tracking variables
        if (!this.lastSpeedIncreaseDistance) {
            this.lastSpeedIncreaseDistance = 0;
            
            // Store original base speed if not already set
            if (!this.originalBaseSpeed) {
                this.originalBaseSpeed = this.controls.baseSpeed;
            }
        }
        
        // Calculate milestone reached - reduce milestone size for more frequent early increases
        const earlyMilestone = 25; // Increase every 25 units until 200
        const lateMilestone = 100; // Then every 100 units
        
        // Determine which milestone system to use based on distance
        const distanceMilestone = distance < 200 ? earlyMilestone : lateMilestone;
        
        const currentMilestone = Math.floor(distance / distanceMilestone);
        const previousMilestone = Math.floor(this.lastSpeedIncreaseDistance / 
                                             (this.lastSpeedIncreaseDistance < 200 ? earlyMilestone : lateMilestone));
        
        // Check if we've crossed a new milestone
        if (currentMilestone > previousMilestone) {
            // Update last increase distance
            this.lastSpeedIncreaseDistance = currentMilestone * distanceMilestone;
            
            // Calculate new level - note that levels will increase faster before 200
            // This is intentional as we want more speed increases early
            const newLevel = currentMilestone + 1;
            
            // Different increase rates before and after 200
            if (distance < 200) {
                // Fast acceleration phase - larger fixed increases
                this.increaseSpeedFixed(newLevel, 15); // Larger early increases
            } else {
                // Slow deceleration phase - logarithmic falloff
                this.increaseSpeedWithDiminishingReturns(newLevel);
            }
        }
    }
    
    // Fixed speed increase for early game (below 200 distance)
    increaseSpeedFixed(newLevel, speedIncrease) {
        const oldLevel = this.currentSpeedLevel || 0;
        this.currentSpeedLevel = newLevel;
        
        // Store original base speed if not stored yet
        if (!this.originalBaseSpeed) {
            this.originalBaseSpeed = this.controls.baseSpeed;
        }
        
        // Convert from display units (km/h) to internal units
        const speedIncreaseInternal = speedIncrease / 100;
        
        // Set the new speed - directly add the fixed increase
        this.controls.baseSpeed += speedIncreaseInternal;
        
        // Log the speed change
        console.log(`EARLY SPEED BOOST: Level ${oldLevel} → ${newLevel}`);
        console.log(`New base speed: ${this.controls.baseSpeed.toFixed(2)} (+${speedIncreaseInternal.toFixed(2)} units)`);
        console.log(`Distance traveled: ${Math.round(this.localPlayer?.distanceTraveled || 0)} units`);
        
        // Show notification to player
        this.showSpeedUpNotification(speedIncrease);
        
        // Also increase difficulty every 2 speed levels
        if (newLevel % 2 === 0 && this.difficultyLevel < 10) {
            this.difficultyLevel++;
            this.showDifficultyNotification(this.difficultyLevel);
        }
    }

    // New method for speed increases with diminishing returns
    increaseSpeedWithDiminishingReturns(newLevel) {
        const oldLevel = this.currentSpeedLevel || 0;
        this.currentSpeedLevel = newLevel;
        
        // Store original base speed if not stored yet
        if (!this.originalBaseSpeed) {
            this.originalBaseSpeed = this.controls.baseSpeed;
        }
        
        // Convert internal speed to display speed (km/h)
        const currentSpeedDisplay = this.controls.baseSpeed * 100;
        const speedThreshold = 250; // Threshold where we slow down acceleration
        
        // Check if we're below or above the threshold
        if (currentSpeedDisplay < speedThreshold) {
            // PHASE 1: Faster acceleration up to 250
            // Fixed speed increase with minor diminishing returns
            const baseIncrease = 12; // Higher base increase for faster initial acceleration
            const minorDiminishingFactor = Math.max(0.8, 1 - (newLevel * 0.015)); // Slight reduction as level increases
            const speedIncrease = baseIncrease * minorDiminishingFactor;
            
            // Convert from display units (km/h) to internal units
            const speedIncreaseInternal = speedIncrease / 100;
            
            // Apply the speed increase
            this.controls.baseSpeed += speedIncreaseInternal;
            
            // Log the speed change
            console.log(`SPEED INCREASED (FAST PHASE): Level ${oldLevel} → ${newLevel}`);
            console.log(`New base speed: ${this.controls.baseSpeed.toFixed(2)} (+${speedIncreaseInternal.toFixed(4)} units)`);
            console.log(`Current speed: ${Math.round(currentSpeedDisplay + speedIncrease)} km/h`);
        } else {
            // PHASE 2: DRAMATICALLY slower acceleration after 250
            // Calculate how far we are above threshold for extremely strong diminishing returns
            const excessSpeed = currentSpeedDisplay - speedThreshold;
            
            // Reduced base increase after threshold (from 10 to 4)
            const baseIncrease = 4;
            
            // Implement much stronger diminishing returns using a more aggressive formula
            // This gives extremely small increases at higher speeds
            const exponentialFactor = excessSpeed / 50; // Increases more quickly with speed
            const strongDiminishingFactor = 1 / (Math.exp(0.5 + exponentialFactor));
            
            // Apply an additional reduction based on current speed
            // This ensures that speed increases get smaller and smaller
            const additionalReduction = Math.max(0.05, 1 - (excessSpeed / 250));
            
            // Calculate the final adjusted increase
            const speedIncrease = baseIncrease * strongDiminishingFactor * additionalReduction;
            
            // Hard cap the increase to prevent it from becoming unplayable
            const cappedIncrease = Math.min(speedIncrease, 2.0);
            
            // Convert from display units (km/h) to internal units
            const speedIncreaseInternal = cappedIncrease / 100;
            
            // Apply the speed increase
            this.controls.baseSpeed += speedIncreaseInternal;
            
            // Calculate percentage of original increase
            const percentOfOriginal = Math.round((strongDiminishingFactor * additionalReduction) * 100);
            
            // Log the speed change
            console.log(`SPEED INCREASED (SLOW PHASE): Level ${oldLevel} → ${newLevel} (${percentOfOriginal}% efficiency)`);
            console.log(`New base speed: ${this.controls.baseSpeed.toFixed(2)} (+${speedIncreaseInternal.toFixed(4)} units)`);
            console.log(`Current speed: ${Math.round(currentSpeedDisplay + cappedIncrease)} km/h (increase: +${cappedIncrease.toFixed(2)} km/h)`);
            
            // Show actual increase in notification
            this.showSpeedUpNotification(Math.round(cappedIncrease));
                    return;
                }
                
        // Show speed up notification for phase 1
        this.showSpeedUpNotification(Math.round(speedIncrease));
        
        // Also increase difficulty every 2 speed levels
        if (newLevel % 2 === 0 && this.difficultyLevel < 10) {
            this.difficultyLevel++;
            this.showDifficultyNotification(this.difficultyLevel);
        }
    }

    // Fix starfield to ensure it's always visible up to at least 3000 distance
    updateStarfield() {
        if (!this.starfield || !this.localPlayer) return;
        
        // Initialize lastPlayerPosition if it doesn't exist
        if (!this.starfield.lastPlayerPosition) {
            this.starfield.lastPlayerPosition = new THREE.Vector3(0, 0, 0);
        }
        
        const positions = this.starfield.geometry.attributes.position.array;
        
        // Check if speeds array exists - if not, initialize it 
        if (!this.starfield.speeds) {
            this.starfield.speeds = new Float32Array(positions.length / 3);
            for (let i = 0; i < this.starfield.speeds.length; i++) {
                this.starfield.speeds[i] = Math.random() * 2 + 0.5;
            }
        }
        
        // Get player mesh - works in both single player and multiplayer modes
        const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
        if (!playerId) return; // Ensure playerId exists
        
        const playerMesh = this.playerMeshes?.get(playerId);
        if (!playerMesh) return;
        
        // Initialize starting position if not set
        if (!this.startPlayerPosition) {
            this.startPlayerPosition = playerMesh.position.clone();
        }
        
        // Calculate how far the player has moved since the last frame
        const playerMovement = new THREE.Vector3();
        // Safety check before accessing vector properties
        if (this.starfield.lastPlayerPosition) {
            if (this.starfield.lastPlayerPosition.x !== 0 || 
                this.starfield.lastPlayerPosition.y !== 0 || 
                this.starfield.lastPlayerPosition.z !== 0) {
                playerMovement.subVectors(playerMesh.position, this.starfield.lastPlayerPosition);
            }
            
            // Store current position for next frame
            this.starfield.lastPlayerPosition.copy(playerMesh.position);
        }
        
        // Check if player has moved far enough to reset the entire starfield
        const distanceFromStart = playerMesh.position.distanceTo(this.startPlayerPosition);
        
        // If player has moved a significant distance, reset the starfield reference point
        // Lower the reset threshold to prevent stars disappearing at 3000 units
        if (distanceFromStart > 1500) {
            console.log("Resetting starfield reference (moved far from start)");
            this.startPlayerPosition.copy(playerMesh.position);
            // Safety check before calling resetEntireStarfield
            if (typeof this.resetEntireStarfield === 'function') {
                this.resetEntireStarfield(playerMesh.position);
            } else {
                // Fallback to resetStars if resetEntireStarfield doesn't exist
                this.resetStars(playerMesh.position);
            }
            return;
        }
        
        const forwardDirection = new THREE.Vector3(0, 0, -1);
        forwardDirection.applyQuaternion(playerMesh.quaternion);

        // Update star positions with optimized loop
        for (let i = 0; i < positions.length; i += 3) {
            // Move stars slightly with player movement to create parallax
            positions[i] -= playerMovement.x * 0.1;
            positions[i + 1] -= playerMovement.y * 0.1;
            positions[i + 2] -= playerMovement.z * 0.1;
            
            // Additional movement based on forward direction
            positions[i] -= forwardDirection.x * this.starfield.speeds[i / 3];
            positions[i + 1] -= forwardDirection.y * this.starfield.speeds[i / 3];
            positions[i + 2] -= forwardDirection.z * this.starfield.speeds[i / 3];

            // Get star position relative to player
            const starX = positions[i] - playerMesh.position.x;
            const starY = positions[i + 1] - playerMesh.position.y;
            const starZ = positions[i + 2] - playerMesh.position.z;
            
            // Calculate distance from player
            const distanceFromPlayer = Math.sqrt(starX * starX + starY * starY + starZ * starZ);
            
            // Reset stars that are too far from player in any direction
            // Recycle stars earlier to prevent them from disappearing
            if (distanceFromPlayer > 1000) {
                // Determine which side of the player to place the star (front is more likely)
                const placeInFront = Math.random() > 0.2; // Increased front bias
                const distance = 500 + Math.random() * 200; // Closer distance
                
                // Create a random direction vector
                const randomDir = new THREE.Vector3(
                    THREE.MathUtils.randFloatSpread(2), 
                    THREE.MathUtils.randFloatSpread(2),
                    placeInFront ? -1 : 1
                ).normalize();
                
                // Position the star in that direction
                positions[i] = playerMesh.position.x + randomDir.x * distance;
                positions[i + 1] = playerMesh.position.y + randomDir.y * distance;
                positions[i + 2] = playerMesh.position.z + randomDir.z * distance;
            }
        }

        this.starfield.geometry.attributes.position.needsUpdate = true;
    }

    // Add back the updateDistanceBasedOnTime method that's called in the animate loop
    updateDistanceBasedOnTime() {
        // Skip if game isn't running
        if (!this.gameState || !this.gameState.isRunning) return;
        
        // Get current time
        const now = Date.now();
        
        // Initialize game start time if needed
        if (!this.gameStartTime) {
            this.gameStartTime = now;
            this.lastDistanceUpdateTime = now;
            return;
        }
        
        // Calculate time elapsed since last update (in seconds)
        const elapsed = (now - this.lastDistanceUpdateTime) / 1000;
        
        // Skip if elapsed time is too small (optimization)
        if (elapsed < 0.016) return; // Skip if less than ~60fps frame time
        
        // Use current speed to calculate distance traveled during this interval
        // Multiply by 60 to make distance match roughly what position-based distance would be
        const distanceIncrement = this.controls.currentSpeed * elapsed * 60;
        
        // Initialize distance if needed
        if (!this.localPlayer.distanceTraveled) {
            this.localPlayer.distanceTraveled = 0;
        }
        
        // Add to total distance in local player object
        this.localPlayer.distanceTraveled += distanceIncrement;
        
        // Check for speed increases (using our new system)
        this.updateSpeedBasedOnDistance();
        
        // Update last update time
        this.lastDistanceUpdateTime = now;
        
        // Update distance display if it exists
        const distanceDisplay = document.getElementById('distance-display');
        if (distanceDisplay) {
            distanceDisplay.textContent = `Distance: ${Math.round(this.localPlayer.distanceTraveled)} units`;
        }
    }

    // Emergency fallback spawn method to guarantee visible asteroids
    spawnEmergencyAsteroid() {
        try {
            console.log("EMERGENCY ASTEROID SPAWN INITIATED");
            
            // Get player mesh
            const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
            const playerMesh = this.playerMeshes.get(playerId);
            
            if (!playerMesh) return null;
            
            // Create a simple asteroid directly
            const geometry = new THREE.IcosahedronGeometry(1, 0);
            const material = new THREE.MeshStandardMaterial({ 
                color: 0xFF4444, // Bright red for visibility
                emissive: 0x441111, // Slight glow
                metalness: 0.3,
                roughness: 0.7
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Make it very visible - larger than normal
            const scale = 0.04; // Larger than normal
            mesh.scale.set(scale, scale, scale);
            
            // Position directly in front of player at close range
            const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
            const spawnDistance = 150; // Very close for guaranteed visibility
            
            mesh.position.copy(playerMesh.position).add(
                playerForward.clone().multiplyScalar(spawnDistance)
            );
            
            // Add to scene
            this.scene.add(mesh);
            
            // Create asteroid object
            const asteroid = {
                mesh: mesh,
                active: true,
                velocity: new THREE.Vector3(0, 0, 0),
                rotationSpeed: new THREE.Vector3(0.005, 0.005, 0.005),
                size: scale * 10,
                creationTime: Date.now(),
                targeting: true,
                targetingFactor: 0.2,
                isEmergency: true // Flag this as an emergency asteroid
            };
            
            // Add to active asteroids array
            if (!this.asteroids) this.asteroids = [];
            this.asteroids.push(asteroid);
            
            console.log("Emergency asteroid spawned directly in front of player");
            return asteroid;
        } catch (error) {
            console.error("Error in emergency asteroid spawn:", error);
            return null;
        }
    }

    // Improve the updateAsteroids method to ensure asteroids are visible
    updateAsteroids(dt) {
        // Skip if game is not running
        if (!this.gameState || !this.gameState.isRunning) return;

        // Get the player mesh
        const playerId = this.singlePlayerMode ? 'local-player' : (this.network?.playerId);
        const playerMesh = this.playerMeshes.get(playerId);
        
        if (!playerMesh) return;
        
        // Make sure we have an asteroids array initialized
        if (!this.asteroids) {
            console.log("Creating new asteroids array in updateAsteroids");
                this.asteroids = [];
            return;
        }

        // Get current player position
        const playerPos = playerMesh.position;
        const collisionResults = [];
        
        // Get player speed for calculations
        let playerSpeed = 1.0;
        if (this.controls && this.controls.baseSpeed) {
            playerSpeed = this.controls.baseSpeed;
        }

        // Loop through active asteroids
        let visibleCount = 0;
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.asteroids[i];
            
            // Skip invalid asteroids
            if (!asteroid || !asteroid.mesh) {
                this.asteroids.splice(i, 1);
                continue;
            }
            
            // Count how many asteroids are actually visible
            if (asteroid.mesh.visible) {
                visibleCount++;
            } else {
                // Force visibility on
                asteroid.mesh.visible = true;
            }
            
            // Handle targeting behavior - adjust velocity to intercept player
            if (asteroid.targetingFactor > 0) {
                // Calculate direction to player
                const toPlayer = new THREE.Vector3().subVectors(playerPos, asteroid.mesh.position).normalize();
                
                // Current direction
                const currentDir = asteroid.velocity.clone().normalize();
                
                // Adjust targeting strength based on proximity to make close encounters more challenging
                const distance = asteroid.mesh.position.distanceTo(playerPos);
                const proximityFactor = Math.max(0.5, Math.min(2.0, 500 / Math.max(10, distance)));
                
                // Calculate adjustment strength based on targeting factor
                const adjustmentStrength = asteroid.targetingFactor * 0.012 * proximityFactor;
                
                // Blend current direction with player direction
                const newDir = new THREE.Vector3()
                    .addScaledVector(currentDir, 1.0 - adjustmentStrength)
                    .addScaledVector(toPlayer, adjustmentStrength)
                    .normalize();
                
                // Adjust speed based on player speed to maintain challenge at higher speeds
                const speedFactor = 0.2 + (playerSpeed * 0.03);
                asteroid.velocity.copy(newDir).multiplyScalar(speedFactor);
            }
            
            // Update position based on velocity
            asteroid.mesh.position.add(asteroid.velocity);
            
            // Apply rotation
            if (asteroid.rotationSpeed) {
                asteroid.mesh.rotation.x += asteroid.rotationSpeed.x;
                asteroid.mesh.rotation.y += asteroid.rotationSpeed.y;
                asteroid.mesh.rotation.z += asteroid.rotationSpeed.z;
            }
            
            // Calculate distance from player
            const distance = asteroid.mesh.position.distanceTo(playerPos);
            
            // Close enough for collision?
            const collisionThreshold = 10 + (asteroid.size || 1) * 0.7;
            if (distance < collisionThreshold) {
                collisionResults.push(asteroid);
            }
            
            // Check if out of range (too far from player)
            const maxDistance = 2000 + (playerSpeed * 200);
            if (distance > maxDistance && !asteroid.isEmergency) {
                // Return asteroid to pool and remove from active list
                this.returnAsteroidToPool(asteroid);
                this.asteroids.splice(i, 1);
            }
        }
        
        // Log how many asteroids are visible (periodically)
        if (Math.random() < 0.005) { // ~1/20th of a second
            console.log(`Currently tracking ${this.asteroids.length} asteroids, ${visibleCount} are visible`);
        }
        
        // Handle collisions
        if (collisionResults.length > 0) {
            // Process closest asteroid first
            collisionResults.sort((a, b) => {
                const distA = a.mesh.position.distanceTo(playerPos);
                const distB = b.mesh.position.distanceTo(playerPos);
                return distA - distB;
            });
            
            this.handleAsteroidCollision(collisionResults[0]);
        }
    }
}

// Start the game client
const client = new GameClient(); 