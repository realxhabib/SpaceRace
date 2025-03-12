// asteroids.js - Generate and manage asteroids
import * as THREE from 'three';

export class AsteroidSystem {
  constructor(scene) {
    this.scene = scene;
    this.asteroids = [];
    this.asteroidMeshes = [];
    this.spawnDistance = 500;
    this.despawnDistance = 600;
    this.maxAsteroids = 100;
    this.spawnRate = 2; // Asteroids per second
    this.spawnTimer = 0;
    this.gameSpeed = 50; // Base speed of the game
    
    // Create asteroid geometries of different sizes with more detail
    this.geometries = [
      new THREE.DodecahedronGeometry(3, 2),  // Small asteroid
      new THREE.IcosahedronGeometry(5, 2),   // Medium asteroid
      new THREE.DodecahedronGeometry(8, 3),  // Large asteroid
      new THREE.IcosahedronGeometry(12, 3)   // Huge asteroid
    ];
    
    // Create realistic asteroid materials with textures
    const loader = new THREE.TextureLoader();
    
    // Load textures for asteroids
    this.asteroidTexture = loader.load('/textures/asteroid_diffuse.jpg');
    this.asteroidBumpMap = loader.load('/textures/asteroid_bump.jpg');
    
    // Create asteroid materials with different colors and properties
    const createAsteroidMaterial = (color, roughness) => {
      return new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: roughness,
        metalness: 0.2,
        flatShading: true,
        map: this.asteroidTexture,
        bumpMap: this.asteroidBumpMap,
        bumpScale: 0.5
      });
    };
    
    this.materials = [
      createAsteroidMaterial(0x8b8b8b, 0.9),  // Gray rocky
      createAsteroidMaterial(0x696969, 0.8),  // Dark gray
      createAsteroidMaterial(0xa0a0a0, 0.7),  // Light gray
      createAsteroidMaterial(0x8B4513, 0.9),  // Brown rocky
      createAsteroidMaterial(0x708090, 0.6)   // Slate gray metallic
    ];
    
    // Initialize object pools for better performance
    this.initObjectPools();
  }
  
  initObjectPools() {
    // Pre-create asteroid objects for reuse
    this.asteroidPool = [];
    const totalPoolSize = this.maxAsteroids * 1.2; // 20% buffer
    
    for (let i = 0; i < totalPoolSize; i++) {
      const geometry = this.geometries[Math.floor(Math.random() * this.geometries.length)];
      const material = this.materials[Math.floor(Math.random() * this.materials.length)];
      const mesh = new THREE.Mesh(geometry, material);
      
      // Add physics properties
      mesh.velocity = new THREE.Vector3();
      mesh.angularVelocity = new THREE.Vector3(
        Math.random() * 0.02 - 0.01,
        Math.random() * 0.02 - 0.01,
        Math.random() * 0.02 - 0.01
      );
      
      // Add collision sphere
      mesh.boundingSphere = new THREE.Sphere(
        mesh.position,
        Math.max(geometry.parameters.radius, 3)
      );
      
      this.asteroidPool.push({
        mesh,
        active: false
      });
    }
  }
  
  spawnAsteroid() {
    // Get inactive asteroid from pool
    const asteroid = this.asteroidPool.find(a => !a.active);
    if (!asteroid) return null;
    
    // Calculate spawn position in a sphere around the player
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const radius = this.spawnDistance;
    
    const position = new THREE.Vector3(
      radius * Math.sin(theta) * Math.cos(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(theta)
    );
    
    // Calculate velocity towards center with some randomness
    const velocity = position.clone()
      .normalize()
      .multiplyScalar(-(Math.random() * 0.5 + 0.5))
      .add(new THREE.Vector3(
        Math.random() * 0.2 - 0.1,
        Math.random() * 0.2 - 0.1,
        Math.random() * 0.2 - 0.1
      ));
    
    // Reset asteroid properties
    asteroid.mesh.position.copy(position);
    asteroid.mesh.velocity.copy(velocity);
    asteroid.mesh.scale.setScalar(Math.random() * 0.5 + 0.5);
    asteroid.mesh.boundingSphere.center.copy(position);
    asteroid.mesh.boundingSphere.radius *= asteroid.mesh.scale.x;
    
    // Randomize rotation
    asteroid.mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    
    // Add to scene and mark as active
    this.scene.add(asteroid.mesh);
    asteroid.active = true;
    this.asteroids.push(asteroid);
    
    return asteroid;
  }
  
  update(delta) {
    // Spawn new asteroids
    this.spawnTimer += delta;
    if (this.spawnTimer >= 1 / this.spawnRate && this.asteroids.length < this.maxAsteroids) {
      this.spawnTimer = 0;
      this.spawnAsteroid();
    }
    
    // Update asteroid positions and rotations
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      const mesh = asteroid.mesh;
      
      // Update position
      mesh.position.add(mesh.velocity);
      
      // Update rotation
      mesh.rotation.x += mesh.angularVelocity.x;
      mesh.rotation.y += mesh.angularVelocity.y;
      mesh.rotation.z += mesh.angularVelocity.z;
      
      // Update bounding sphere
      mesh.boundingSphere.center.copy(mesh.position);
      
      // Remove if too far
      if (mesh.position.length() > this.despawnDistance) {
        this.scene.remove(mesh);
        asteroid.active = false;
        this.asteroids.splice(i, 1);
      }
    }
  }
  
  checkCollision(object) {
    // Assuming object has a boundingSphere property
    for (const asteroid of this.asteroids) {
      if (asteroid.mesh.boundingSphere.intersectsSphere(object.boundingSphere)) {
        return asteroid;
      }
    }
    return null;
  }
  
  reset() {
    // Remove all asteroids from scene
    for (const asteroid of this.asteroids) {
      this.scene.remove(asteroid.mesh);
      asteroid.active = false;
    }
    this.asteroids = [];
    this.spawnTimer = 0;
  }
}
