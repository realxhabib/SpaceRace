// controls.js - Handle player input and spaceship controls
import * as THREE from 'three';

export function setupControls(camera, spaceship) {
  // Control state
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
    fire: false,
    usePowerup: false
  };
  
  // Movement parameters
  const ROTATION_SPEED = 0.03;
  const MOUSE_SENSITIVITY = 0.002;
  const CAMERA_LAG = 0.1;
  
  // Camera offset from spaceship
  const cameraOffset = new THREE.Vector3(0, 2, 10);
  let targetCameraPosition = new THREE.Vector3();
  
  // Setup keyboard event listeners
  document.addEventListener('keydown', (event) => {
    updateKeys(event.code, true);
  });
  
  document.addEventListener('keyup', (event) => {
    updateKeys(event.code, false);
  });
  
  // Lock pointer for first-person controls
  document.addEventListener('click', () => {
    document.body.requestPointerLock();
  });
  
  // Mouse movement for rotation
  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
      mouseX = event.movementX * MOUSE_SENSITIVITY;
      mouseY = event.movementY * MOUSE_SENSITIVITY;
    }
  });
  
  function updateKeys(code, pressed) {
    switch (code) {
      case 'KeyW':
        keys.forward = pressed;
        break;
      case 'KeyS':
        keys.backward = pressed;
        break;
      case 'KeyA':
        keys.left = pressed;
        break;
      case 'KeyD':
        keys.right = pressed;
        break;
      case 'Space':
        keys.boost = pressed;
        break;
      case 'KeyE':
        keys.usePowerup = pressed;
        break;
      case 'Mouse0':
      case 'LeftMouseButton':
        keys.fire = pressed;
        break;
    }
  }
  
  function updateCamera() {
    // Calculate target camera position based on ship position and rotation
    const shipPosition = spaceship.getPosition();
    const shipRotation = spaceship.getRotation();
    
    // Calculate offset based on ship's rotation
    const rotatedOffset = cameraOffset.clone()
      .applyEuler(new THREE.Euler(shipRotation.x, shipRotation.y, shipRotation.z));
    
    // Set target position
    targetCameraPosition.copy(shipPosition).add(rotatedOffset);
    
    // Smoothly interpolate camera position
    camera.position.lerp(targetCameraPosition, CAMERA_LAG);
    
    // Make camera look at ship
    camera.lookAt(shipPosition);
  }
  
  function update(delta) {
    // Handle rotation
    if (document.pointerLockElement) {
      spaceship.rotate(
        -mouseY * ROTATION_SPEED,
        -mouseX * ROTATION_SPEED,
        keys.left ? ROTATION_SPEED : keys.right ? -ROTATION_SPEED : 0
      );
      
      // Reset mouse movement
      mouseX = 0;
      mouseY = 0;
    }
    
    // Handle movement
    if (keys.forward) {
      spaceship.thrust(true);
    }
    if (keys.backward) {
      spaceship.thrust(false);
    }
    
    // Update spaceship physics
    spaceship.update();
    
    // Update camera position
    updateCamera();
    
    // Handle powerup use
    if (keys.usePowerup) {
      spaceship.usePowerup();
      keys.usePowerup = false; // Reset to prevent continuous use
    }
  }
  
  return {
    update,
    keys
  };
}
