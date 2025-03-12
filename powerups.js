// powerups.js - Generate and manage power-ups
import * as THREE from 'three';

export class PowerupSystem {
  constructor(scene) {
    this.scene = scene;
    this.powerups = [];
    this.spawnDistance = 300; // Closer to make them more accessible
    this.despawnDistance = 400;
    this.maxPowerups = 10;
    this.spawnRate = 0.2; // Powerups per second
    this.spawnTimer = 0;
    
    // Define powerup types with enhanced effects
    this.powerupTypes = [
      {
        name: 'Shield',
        type: 'shield',
        color: 0x00ff00,
        duration: 10,
        model: this.createShieldModel(),
        effect: (player) => {
          player.isInvulnerable = true;
          // Create shield effect
          const shield = this.createShieldEffect(player);
          
          return {
            update: (delta) => {
              shield.rotation.y += delta * 2;
              shield.rotation.x += delta;
            },
            cleanup: () => {
              player.isInvulnerable = false;
              this.scene.remove(shield);
            }
          };
        }
      },
      {
        name: 'Speed Boost',
        type: 'speed',
        color: 0xff0000,
        duration: 5,
        model: this.createSpeedBoostModel(),
        effect: (player) => {
          const originalSpeed = player.MAX_SPEED;
          player.MAX_SPEED *= 2;
          
          // Create speed trail effect
          const trail = this.createSpeedTrail(player);
          
          return {
            update: (delta) => {
              trail.update(delta);
            },
            cleanup: () => {
              player.MAX_SPEED = originalSpeed;
              trail.cleanup();
            }
          };
        }
      },
      {
        name: 'Triple Shot',
        type: 'weapon',
        color: 0xff00ff,
        duration: 15,
        model: this.createWeaponModel(),
        effect: (player) => {
          player.weaponType = 'triple';
          const originalFire = player.fire;
          
          player.fire = () => {
            // Fire three projectiles in a spread
            for (let i = -1; i <= 1; i++) {
              const spread = new THREE.Vector3(i * 0.2, 0, 0);
              originalFire(spread);
            }
          };
          
          return {
            update: () => {},
            cleanup: () => {
              player.weaponType = 'normal';
              player.fire = originalFire;
            }
          };
        }
      },
      {
        name: 'EMP',
        type: 'emp',
        color: 0x00ffff,
        duration: 0,
        model: this.createEMPModel(),
        effect: (player) => {
          // Create expanding EMP wave
          const emp = this.createEMPWave(player.position);
          
          return {
            update: (delta) => {
              emp.scale.addScalar(delta * 100);
              emp.material.opacity -= delta * 0.5;
              
              if (emp.material.opacity <= 0) {
                this.scene.remove(emp);
              }
            },
            cleanup: () => {
              this.scene.remove(emp);
            }
          };
        }
      }
    ];
    
    // Initialize object pool
    this.initObjectPool();
  }
  
  createShieldModel() {
    const geometry = new THREE.OctahedronGeometry(2, 2);
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.6,
      shininess: 100
    });
    return new THREE.Mesh(geometry, material);
  }
  
  createSpeedBoostModel() {
    const geometry = new THREE.ConeGeometry(1.5, 3, 8);
    const material = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      emissive: 0x500000
    });
    return new THREE.Mesh(geometry, material);
  }
  
  createWeaponModel() {
    const group = new THREE.Group();
    
    // Create three small spheres in a triangle
    const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const material = new THREE.MeshPhongMaterial({
      color: 0xff00ff,
      emissive: 0x500050
    });
    
    for (let i = 0; i < 3; i++) {
      const sphere = new THREE.Mesh(sphereGeometry, material);
      const angle = (i * Math.PI * 2) / 3;
      sphere.position.set(Math.cos(angle), Math.sin(angle), 0);
      group.add(sphere);
    }
    
    return group;
  }
  
  createEMPModel() {
    const geometry = new THREE.SphereGeometry(1.5, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ffff,
      emissive: 0x005555,
      transparent: true,
      opacity: 0.8
    });
    return new THREE.Mesh(geometry, material);
  }
  
  createShieldEffect(player) {
    const geometry = new THREE.SphereGeometry(5, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(geometry, material);
    
    player.mesh.add(shield);
    return shield;
  }
  
  createSpeedTrail(player) {
    const trailPoints = [];
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5
    });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    
    this.scene.add(trail);
    
    return {
      update: (delta) => {
        trailPoints.unshift(player.mesh.position.clone());
        if (trailPoints.length > 20) {
          trailPoints.pop();
        }
        
        trailGeometry.setFromPoints(trailPoints);
      },
      cleanup: () => {
        this.scene.remove(trail);
      }
    };
  }
  
  createEMPWave(position) {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      wireframe: true
    });
    const wave = new THREE.Mesh(geometry, material);
    wave.position.copy(position);
    this.scene.add(wave);
    return wave;
  }
  
  initObjectPool() {
    this.powerupPool = [];
    const poolSize = this.maxPowerups * 2;
    
    for (let i = 0; i < poolSize; i++) {
      const type = this.powerupTypes[Math.floor(Math.random() * this.powerupTypes.length)];
      const model = type.model.clone();
      
      // Add physics properties
      model.velocity = new THREE.Vector3();
      model.boundingSphere = new THREE.Sphere(model.position, 2);
      
      this.powerupPool.push({
        type,
        model,
        active: false
      });
    }
  }
  
  spawnPowerup() {
    const powerup = this.powerupPool.find(p => !p.active);
    if (!powerup) return null;
    
    // Random position in a sphere around the center
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const r = this.spawnDistance;
    
    const position = new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta)
    );
    
    powerup.model.position.copy(position);
    powerup.model.boundingSphere.center.copy(position);
    
    this.scene.add(powerup.model);
    powerup.active = true;
    this.powerups.push(powerup);
    
    return powerup;
  }
  
  update(delta) {
    // Spawn new powerups
    this.spawnTimer += delta;
    if (this.spawnTimer >= 1 / this.spawnRate && this.powerups.length < this.maxPowerups) {
      this.spawnTimer = 0;
      this.spawnPowerup();
    }
    
    // Update powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      
      // Rotate powerup
      powerup.model.rotation.y += delta;
      
      // Bob up and down
      powerup.model.position.y += Math.sin(Date.now() * 0.002) * 0.01;
      
      // Update bounding sphere
      powerup.model.boundingSphere.center.copy(powerup.model.position);
      
      // Remove if too far
      if (powerup.model.position.length() > this.despawnDistance) {
        this.scene.remove(powerup.model);
        powerup.active = false;
        this.powerups.splice(i, 1);
      }
    }
  }
  
  checkCollision(object) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      if (powerup.model.boundingSphere.intersectsSphere(object.boundingSphere)) {
        // Remove powerup
        this.scene.remove(powerup.model);
        powerup.active = false;
        this.powerups.splice(i, 1);
        
        return powerup.type;
      }
    }
    return null;
  }
  
  reset() {
    for (const powerup of this.powerups) {
      this.scene.remove(powerup.model);
      powerup.active = false;
    }
    this.powerups = [];
    this.spawnTimer = 0;
  }
}

