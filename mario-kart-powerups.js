// Update the spaceship's usePowerup method to implement Mario Kart style powerup effects
import * as THREE from 'three';

export function enhanceSpaceshipWithMarioKartPowerups(spaceship, gameState) {
  // Store the original usePowerup method
  const originalUsePowerup = spaceship.usePowerup;
  
  // Replace with enhanced version
  spaceship.usePowerup = function() {
    if (!this.getPowerup()) return false;
    
    const powerup = this.getPowerup();
    const effect = powerup.effect;
    
    // Implement different powerup effects based on type
    switch(effect) {
      case 'shield': // Star
        // Create star shield effect around player
        createStarShieldEffect(gameState);
        break;
        
      case 'missile': // Red Shell
        // Launch a homing red shell at nearest opponent
        launchRedShell(gameState);
        break;
        
      case 'speed': // Mushroom
        // Apply speed boost
        applySpeedBoost(gameState);
        break;
        
      case 'lightning': // Lightning
        // Slow down all other players
        applyLightningEffect(gameState);
        break;
        
      case 'banana': // Banana
        // Drop a banana behind the player
        dropBanana(gameState);
        break;
        
      case 'blueshell': // Blue Shell
        // Target the player in first place
        launchBlueShell(gameState);
        break;
        
      default:
        // Use original implementation for other powerups
        return originalUsePowerup.call(this);
    }
    
    // Clear the powerup after use
    this.setPowerup(null);
    return effect;
  };
  
  return spaceship;
}

// Create star shield effect (invincibility)
function createStarShieldEffect(gameState) {
  const playerMesh = gameState.localPlayer.mesh;
  if (!playerMesh) return;
  
  // Create star particles orbiting the player
  const particleCount = 20;
  const particles = [];
  
  for (let i = 0; i < particleCount; i++) {
    const starGeometry = new THREE.OctahedronGeometry(0.3, 0);
    const starMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      emissive: 0xFFD700,
      emissiveIntensity: 1
    });
    
    const star = new THREE.Mesh(starGeometry, starMaterial);
    gameState.scene.add(star);
    
    // Set initial position in sphere around player
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI * 2;
    
    const radius = 3;
    star.position.set(
      playerMesh.position.x + Math.sin(angle1) * Math.cos(angle2) * radius,
      playerMesh.position.y + Math.sin(angle1) * Math.sin(angle2) * radius,
      playerMesh.position.z + Math.cos(angle1) * radius
    );
    
    // Store particle data
    particles.push({
      mesh: star,
      angle1: angle1,
      angle2: angle2,
      speed: 0.05 + Math.random() * 0.05
    });
  }
  
  // Add star effect to gameState for update loop
  gameState.starEffect = {
    particles: particles,
    duration: 10, // seconds
    elapsed: 0,
    
    update: function(delta) {
      this.elapsed += delta;
      
      // Update particle positions
      for (const particle of this.particles) {
        particle.angle1 += particle.speed;
        particle.angle2 += particle.speed * 0.7;
        
        const radius = 3;
        particle.mesh.position.set(
          playerMesh.position.x + Math.sin(particle.angle1) * Math.cos(particle.angle2) * radius,
          playerMesh.position.y + Math.sin(particle.angle1) * Math.sin(particle.angle2) * radius,
          playerMesh.position.z + Math.cos(particle.angle1) * radius
        );
        
        // Rotate particle
        particle.mesh.rotation.x += 0.05;
        particle.mesh.rotation.y += 0.05;
      }
      
      // Check if effect has expired
      if (this.elapsed >= this.duration) {
        // Remove particles
        for (const particle of this.particles) {
          gameState.scene.remove(particle.mesh);
        }
        
        return true; // Effect expired
      }
      
      return false; // Effect still active
    }
  };
  
  // Set invincibility flag
  gameState.localPlayer.invincible = true;
  
  // Clear invincibility after duration
  setTimeout(() => {
    gameState.localPlayer.invincible = false;
  }, 10000); // 10 seconds
}

// Launch a homing red shell at nearest opponent
function launchRedShell(gameState) {
  // Find nearest opponent
  let nearestOpponent = null;
  let nearestDistance = Infinity;
  
  const playerPosition = gameState.localPlayer.mesh.position;
  
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    
    // Skip local player and eliminated players
    if (player.id === gameState.localPlayer.id || player.eliminated) {
      continue;
    }
    
    // Calculate distance
    const distance = new THREE.Vector3(
      player.position.x - playerPosition.x,
      player.position.y - playerPosition.y,
      player.position.z - playerPosition.z
    ).length();
    
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestOpponent = player;
    }
  }
  
  if (!nearestOpponent) return; // No opponents found
  
  // Create red shell
  const shellGeometry = new THREE.SphereGeometry(1, 16, 16);
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0xe74c3c,
    emissive: 0xe74c3c,
    emissiveIntensity: 0.5
  });
  
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.position.copy(playerPosition);
  gameState.scene.add(shell);
  
  // Add shell to game state
  gameState.redShells = gameState.redShells || [];
  gameState.redShells.push({
    mesh: shell,
    target: nearestOpponent,
    speed: 2,
    
    update: function(delta) {
      // Move towards target
      const targetPosition = this.target.position;
      const direction = new THREE.Vector3(
        targetPosition.x - this.mesh.position.x,
        targetPosition.y - this.mesh.position.y,
        targetPosition.z - this.mesh.position.z
      ).normalize();
      
      this.mesh.position.x += direction.x * this.speed;
      this.mesh.position.y += direction.y * this.speed;
      this.mesh.position.z += direction.z * this.speed;
      
      // Rotate shell
      this.mesh.rotation.x += 0.1;
      this.mesh.rotation.y += 0.1;
      
      // Check if shell has reached target
      const distance = new THREE.Vector3(
        targetPosition.x - this.mesh.position.x,
        targetPosition.y - this.mesh.position.y,
        targetPosition.z - this.mesh.position.z
      ).length();
      
      if (distance < 2) {
        // Hit target
        gameState.scene.remove(this.mesh);
        
        // Apply damage to target
        if (gameState.networkManager) {
          gameState.networkManager.usePowerup(this.target.id, 'missile');
        }
        
        return true; // Shell hit target
      }
      
      return false; // Shell still tracking
    }
  });
}

// Apply speed boost (Mushroom)
function applySpeedBoost(gameState) {
  // Apply speed boost to player
  gameState.localPlayer.speedBoost = 2.5; // 2.5x normal speed
  
  // Create speed trail effect
  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.PointsMaterial({
    color: 0xff5500,
    size: 0.5,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8
  });
  
  const trailParticles = new THREE.Points(trailGeometry, trailMaterial);
  gameState.scene.add(trailParticles);
  
  // Add trail to gameState
  gameState.speedTrail = {
    particles: trailParticles,
    positions: [],
    maxPositions: 50,
    
    update: function(delta) {
      const playerPosition = gameState.localPlayer.mesh.position;
      
      // Add current position to trail
      this.positions.unshift({
        x: playerPosition.x,
        y: playerPosition.y,
        z: playerPosition.z,
        age: 0
      });
      
      // Limit trail length
      if (this.positions.length > this.maxPositions) {
        this.positions.pop();
      }
      
      // Update particle positions
      const positions = new Float32Array(this.positions.length * 3);
      
      for (let i = 0; i < this.positions.length; i++) {
        const pos = this.positions[i];
        pos.age += delta;
        
        const i3 = i * 3;
        positions[i3] = pos.x;
        positions[i3 + 1] = pos.y;
        positions[i3 + 2] = pos.z;
      }
      
      // Update geometry
      trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  };
  
  // Reset speed after duration
  setTimeout(() => {
    gameState.localPlayer.speedBoost = 1.0;
    gameState.scene.remove(trailParticles);
    delete gameState.speedTrail;
  }, 5000); // 5 seconds
}

// Apply lightning effect to all other players
function applyLightningEffect(gameState) {
  // Create lightning flash effect
  const flash = new THREE.AmbientLight(0xffffff, 2);
  gameState.scene.add(flash);
  
  // Fade out flash
  let flashIntensity = 2;
  const fadeFlash = () => {
    flashIntensity -= 0.1;
    if (flashIntensity > 0) {
      flash.intensity = flashIntensity;
      setTimeout(fadeFlash, 50);
    } else {
      gameState.scene.remove(flash);
    }
  };
  
  setTimeout(fadeFlash, 100);
  
  // Apply slow effect to other players via network
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    
    // Skip local player and eliminated players
    if (player.id === gameState.localPlayer.id || player.eliminated) {
      continue;
    }
    
    // Apply lightning effect via network
    if (gameState.networkManager) {
      gameState.networkManager.usePowerup(player.id, 'lightning');
    }
  }
}

// Drop a banana behind the player
function dropBanana(gameState) {
  const playerPosition = gameState.localPlayer.mesh.position.clone();
  const playerRotation = gameState.localPlayer.mesh.rotation.clone();
  
  // Calculate position behind player
  const behindDirection = new THREE.Vector3(0, 0, 1);
  behindDirection.applyQuaternion(new THREE.Quaternion().setFromEuler(playerRotation));
  behindDirection.multiplyScalar(-5); // 5 units behind
  
  const bananaPosition = playerPosition.clone().add(behindDirection);
  
  // Create banana
  const bananaGeometry = new THREE.SphereGeometry(1, 16, 16);
  const bananaMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFF00,
    emissive: 0xFFFF00,
    emissiveIntensity: 0.3
  });
  
  const banana = new THREE.Mesh(bananaGeometry, bananaMaterial);
  banana.position.copy(bananaPosition);
  banana.scale.set(1, 0.5, 2);
  banana.rotation.x = Math.PI / 2;
  gameState.scene.add(banana);
  
  // Add banana to game state
  gameState.bananas = gameState.bananas || [];
  gameState.bananas.push({
    mesh: banana,
    position: bananaPosition,
    rotation: Math.random() * Math.PI * 2,
    
    update: function(delta) {
      // Rotate banana
      this.rotation += delta * 2;
      this.mesh.rotation.z = this.rotation;
      
      // Check for collisions with players
      for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        
        // Skip local player and eliminated players
        if (player.id === gameState.localPlayer.id || player.eliminated) {
          continue;
        }
        
        // Calculate distance
        const distance = new THREE.Vector3(
          player.position.x - this.position.x,
          player.position.y - this.position.y,
          player.position.z - this.position.z
        ).length();
        
        if (distance < 3) {
          // Hit player
          gameState.scene.remove(this.mesh);
          
          // Apply banana effect to player
          if (gameState.networkManager) {
            gameState.networkManager.usePowerup(player.id, 'banana');
          }
          
          return true; // Banana used
        }
      }
      
      return false; // Banana still active
    }
  });
}

// Launch a blue shell at the player in first place
function launchBlueShell(gameState) {
  // Find player in first place
  let firstPlacePlayer = null;
  let highestScore = -1;
  
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    
    // Skip eliminated players
    if (player.eliminated) {
      continue;
    }
    
    // Find player with highest score
    if (player.score > highestScore) {
      highestScore = player.score;
      firstPlacePlayer = player;
    }
  }
  
  if (!firstPlacePlayer) return; // No players found
  
  // Create blue shell
  const shellGeometry = new THREE.SphereGeometry(1.5, 16, 16);
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0x3498db,
    emissive: 0x3498db,
    emissiveIntensity: 0.5
  });
  
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.position.copy(gameState.localPlayer.mesh.position);
  gameState.scene.add(shell);
  
  // Add wings to shell
  const wingGeometry = new THREE.BoxGeometry(1, 0.1, 0.5);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff
  });
  
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.set(-1.5, 0, 0);
  shell.add(leftWing);
  
  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.position.set(1.5, 0, 0);
  shell.add(rightWing);
  
  // Add blue shell to game state
  gameState.blueShells = gameState.blueShells || [];
  gameState.blueShells.push({
    mesh: shell,
    target: firstPlacePlayer,
    speed: 3,
    height: 20, // Height above players
    phase: 'rising', // rising, tracking, diving
    
    update: function(delta) {
      const targetPosition = this.target.position;
      
      switch(this.phase) {
        case 'rising':
          // Rise up
          this.mesh.position.y += this.speed;
          
          // Transition to tracking when high enough
          if (this.mesh.position.y > this.height) {
            this.phase = 'tracking';
          }
          break;
          
        case 'tracking':
          // Move towards target (x and z only)
          const direction = new THREE.Vector3(
            targetPosition.x - this.mesh.position.x,
            0,
            targetPosition.z - this.mesh.position.z
          ).normalize();
          
          this.mesh.position.x += direction.x * this.speed;
          this.mesh.position.z += direction.z * this.speed;
          
          // Maintain height
          this.mesh.position.y = this.height;
          
          // Rotate shell
          this.mesh.rotation.y += 0.1;
          
          // Check if shell is above target
          const horizontalDistance = new THREE.Vector3(
            targetPosition.x - this.mesh.position.x,
            0,
            targetPosition.z - this.mesh.position.z
          ).length();
          
          if (horizontalDistance < 5) {
            this.phase = 'diving';
          }
          break;
          
        case 'diving':
          // Dive towards target
          const diveDirection = new THREE.Vector3(
            targetPosition.x - this.mesh.position.x,
            targetPosition.y - this.mesh.position.y,
            targetPosition.z - this.mesh.position.z
          ).normalize();
          
          this.mesh.position.x += diveDirection.x * this.speed * 2;
          this.mesh.position.y += diveDirection.y * this.speed * 2;
          this.mesh.position.z += diveDirection.z * this.speed * 2;
          
          // Rotate shell faster
          this.mesh.rotation.x += 0.2;
          this.mesh.rotation.y += 0.2;
          
          // Check if shell has reached target
          const distance = new THREE.Vector3(
            targetPosition.x - this.mesh.position.x,
            targetPosition.y - this.mesh.position.y,
            targetPosition.z - this.mesh.position.z
          ).length();
          
          if (distance < 2) {
            // Hit target with explosion
            gameState.scene.remove(this.mesh);
            
         <response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>