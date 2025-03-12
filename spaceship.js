import * as THREE from 'three';

export function createSpaceship(scene) {
  // Spaceship properties
  let health = 100;
  let currentPowerup = null;
  let velocity = new THREE.Vector3();
  let acceleration = new THREE.Vector3();
  const MAX_SPEED = 2.0;
  const ACCELERATION = 0.05;
  const DECELERATION = 0.02;

  // Create spaceship geometry
  const geometry = new THREE.Group();
  
  // Main body
  const bodyGeometry = new THREE.ConeGeometry(1, 4, 8);
  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x3366ff,
    shininess: 100,
    specular: 0x111111
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.x = Math.PI / 2;
  geometry.add(body);

  // Wings
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
  geometry.add(leftWing);
  geometry.add(rightWing);

  // Engine glow
  const engineGlow = new THREE.PointLight(0x00ffff, 1, 5);
  engineGlow.position.set(0, 0, -2);
  geometry.add(engineGlow);

  // Add to scene
  scene.add(geometry);

  // Movement functions
  function thrust(forward = true) {
    const direction = new THREE.Vector3(0, 0, forward ? -1 : 1);
    direction.applyQuaternion(geometry.quaternion);
    acceleration.add(direction.multiplyScalar(ACCELERATION));
  }

  function updatePhysics() {
    // Apply acceleration
    velocity.add(acceleration);
    
    // Apply max speed limit
    if (velocity.length() > MAX_SPEED) {
      velocity.normalize().multiplyScalar(MAX_SPEED);
    }
    
    // Apply deceleration
    velocity.multiplyScalar(1 - DECELERATION);
    
    // Update position
    geometry.position.add(velocity);
    
    // Reset acceleration
    acceleration.set(0, 0, 0);
  }

  return {
    mesh: geometry,
    velocity,
    acceleration,
    
    update() {
      updatePhysics();
    },
    
    thrust,
    
    rotate(x, y, z) {
      geometry.rotation.x += x;
      geometry.rotation.y += y;
      geometry.rotation.z += z;
    },
    
    damage(amount) {
      health -= amount;
      if (health < 0) health = 0;
      return health;
    },
    
    heal(amount) {
      health += amount;
      if (health > 100) health = 100;
      return health;
    },
    
    getHealth() {
      return health;
    },
    
    getPowerup() {
      return currentPowerup;
    },
    
    setPowerup(powerup) {
      currentPowerup = powerup;
      return currentPowerup;
    },
    
    usePowerup() {
      if (!currentPowerup) return false;
      const effect = currentPowerup.effect;
      currentPowerup = null;
      return effect;
    },
    
    getPosition() {
      return geometry.position.clone();
    },
    
    getRotation() {
      return geometry.rotation.clone();
    },
    
    reset() {
      geometry.position.set(0, 0, 50);
      geometry.rotation.set(0, 0, 0);
      velocity.set(0, 0, 0);
      acceleration.set(0, 0, 0);
      health = 100;
      currentPowerup = null;
    }
  };
}