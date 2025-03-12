// planets.js - Generate and manage planets in the distance
import * as THREE from 'three';

export class PlanetSystem {
  constructor(scene) {
    this.scene = scene;
    this.planets = [];
    this.spawnDistance = 5000;
    this.despawnDistance = 1000;
    this.maxPlanets = 5;
    this.spawnRate = 0.02; // Planets per second
    this.spawnTimer = 0;
    this.gameSpeed = 50; // Base speed of the game
    
    // Define planet types
    this.planetTypes = [
      {
        name: 'Earth-like',
        baseColor: 0x2980b9,
        landColor: 0x27ae60,
        cloudColor: 0xffffff,
        size: 300,
        hasRings: false,
        hasClouds: true,
        hasAtmosphere: true
      },
      {
        name: 'Gas Giant',
        baseColor: 0xf39c12,
        landColor: 0xe67e22,
        cloudColor: 0xecf0f1,
        size: 500,
        hasRings: true,
        hasClouds: true,
        hasAtmosphere: false
      },
      {
        name: 'Rocky Planet',
        baseColor: 0x7f8c8d,
        landColor: 0x95a5a6,
        cloudColor: 0x000000,
        size: 200,
        hasRings: false,
        hasClouds: false,
        hasAtmosphere: false
      },
      {
        name: 'Ice Planet',
        baseColor: 0x3498db,
        landColor: 0xecf0f1,
        cloudColor: 0xbdc3c7,
        size: 250,
        hasRings: false,
        hasClouds: true,
        hasAtmosphere: true
      },
      {
        name: 'Lava Planet',
        baseColor: 0xc0392b,
        landColor: 0xe74c3c,
        cloudColor: 0x7f8c8d,
        size: 280,
        hasRings: false,
        hasClouds: true,
        hasAtmosphere: true
      }
    ];
  }
  
  init() {
    // Clear any existing planets
    this.reset();
    
    // Create initial planets
    this.spawnPlanet();
  }
  
  createPlanetMesh(planetType) {
    // Create planet group
    const planetGroup = new THREE.Group();
    
    // Create planet sphere
    const planetGeometry = new THREE.SphereGeometry(planetType.size, 64, 64);
    const planetMaterial = new THREE.MeshPhongMaterial({
      color: planetType.baseColor,
      shininess: 10,
      bumpScale: 1
    });
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planetGroup.add(planet);
    
    // Add land features
    if (planetType.landColor) {
      const landGeometry = new THREE.SphereGeometry(planetType.size * 1.001, 32, 32);
      const landMaterial = new THREE.MeshPhongMaterial({
        color: planetType.landColor,
        transparent: true,
        opacity: 0.8,
        alphaMap: this.createNoiseTexture(512, 0.7)
      });
      const land = new THREE.Mesh(landGeometry, landMaterial);
      planetGroup.add(land);
    }
    
    // Add clouds
    if (planetType.hasClouds) {
      const cloudGeometry = new THREE.SphereGeometry(planetType.size * 1.02, 32, 32);
      const cloudMaterial = new THREE.MeshPhongMaterial({
        color: planetType.cloudColor,
        transparent: true,
        opacity: 0.6,
        alphaMap: this.createNoiseTexture(512, 0.3)
      });
      const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
      planetGroup.add(clouds);
    }
    
    // Add atmosphere glow
    if (planetType.hasAtmosphere) {
      const atmosphereGeometry = new THREE.SphereGeometry(planetType.size * 1.1, 32, 32);
      const atmosphereMaterial = new THREE.MeshPhongMaterial({
        color: planetType.baseColor,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
      });
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      planetGroup.add(atmosphere);
    }
    
    // Add rings
    if (planetType.hasRings) {
      const ringGeometry = new THREE.RingGeometry(
        planetType.size * 1.5,
        planetType.size * 2.5,
        64
      );
      const ringMaterial = new THREE.MeshPhongMaterial({
        color: 0xecf0f1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        alphaMap: this.createRingTexture(512)
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      planetGroup.add(ring);
    }
    
    return planetGroup;
  }
  
  createNoiseTexture(size, threshold) {
    // Create a canvas for the texture
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);
    
    // Add noise
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.random();
      const alpha = value > threshold ? (value - threshold) / (1 - threshold) * 255 : 0;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = alpha;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
  }
  
  createRingTexture(size) {
    // Create a canvas for the texture
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);
    
    // Add ring pattern
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    const center = size / 2;
    
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const index = (y * size + x) * 4;
        const distX = x - center;
        const distY = y - center;
        const dist = Math.sqrt(distX * distX + distY * distY) / center;
        
        if (dist < 1) {
          const noise = Math.random() * 0.3 + 0.7;
          const band = Math.sin(dist * 30) * 0.5 + 0.5;
          const alpha = band * noise * 255;
          
          data[index] = 255;
          data[index + 1] = 255;
          data[index + 2] = 255;
          data[index + 3] = alpha;
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
  }
  
  spawnPlanet() {
    if (this.planets.length >= this.maxPlanets) return;
    
    // Randomly select planet type
    const planetType = this.planetTypes[Math.floor(Math.random() * this.planetTypes.length)];
    
    // Create planet mesh
    const mesh = this.createPlanetMesh(planetType);
    
    // Set random position off to the side
    const side = Math.random() > 0.5 ? 1 : -1;
    const distance = 2000 + Math.random() * 3000;
    const x = side * distance;
    const y = -500 + Math.random() * 1000;
    const z = -this.spawnDistance - Math.random() * 5000;
    
    mesh.position.set(x, y, z);
    
    // Add random rotation
    mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    
    // Add to scene
    this.scene.add(mesh);
    
    // Add ambient light near the planet
    const light = new THREE.PointLight(0xffffff, 1, 5000);
    light.position.set(x + 1000, y + 1000, z);
    this.scene.add(light);
    
    // Store planet data
    this.planets.push({
      mesh,
      light,
      type: planetType.name,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.001,
        y: (Math.random() - 0.5) * 0.001,
        z: (Math.random() - 0.5) * 0.001
      }
    });
  }
  
  update(delta) {
    // Update spawn timer
    this.spawnTimer += delta;
    if (this.spawnTimer > 1 / this.spawnRate) {
      this.spawnTimer = 0;
      this.spawnPlanet();
    }
    
    // Update planet positions
    for (let i = this.planets.length - 1; i >= 0; i--) {
      const planet = this.planets[i];
      const mesh = planet.mesh;
      
      // Move planet
      mesh.position.z += this.gameSpeed * delta;
      planet.light.position.z += this.gameSpeed * delta;
      
      // Rotate planet
      mesh.rotation.x += planet.rotationSpeed.x;
      mesh.rotation.y += planet.rotationSpeed.y;
      mesh.rotation.z += planet.rotationSpeed.z;
      
      // Remove if too close
      if (mesh.position.z > this.despawnDistance) {
        this.scene.remove(mesh);
        this.scene.remove(planet.light);
        this.planets.splice(i, 1);
      }
    }
  }
  
  reset() {
    // Remove all planets
    for (const planet of this.planets) {
      this.scene.remove(planet.mesh);
      this.scene.remove(planet.light);
    }
    this.planets = [];
    this.spawnTimer = 0;
  }
}
