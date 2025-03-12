// ui.js - Manage game UI elements
import * as THREE from 'three';

export class UIManager {
  constructor(gameState) {
    this.gameState = gameState;
    
    // Get UI elements
    this.healthBar = document.getElementById('health-fill');
    this.powerupDisplay = document.getElementById('powerup-display');
    this.playersRemainingDisplay = document.getElementById('players-remaining');
    this.gameOverScreen = document.getElementById('game-over');
    this.gameOverText = document.getElementById('game-over-text');
    
    // Powerup icons
    this.powerupIcons = {
      shield: '🛡️',
      missile: '🚀',
      speed: '⚡',
      emp: '💥'
    };
  }
  
  update() {
    // Update health bar
    if (this.gameState.localPlayer) {
      const health = this.gameState.localPlayer.health;
      this.healthBar.style.width = `${health}%`;
      
      // Change color based on health
      if (health > 60) {
        this.healthBar.style.backgroundColor = '#2ecc71';
      } else if (health > 30) {
        this.healthBar.style.backgroundColor = '#f39c12';
      } else {
        this.healthBar.style.backgroundColor = '#e74c3c';
      }
    }
    
    // Update powerup display
    this.updatePowerupDisplay();
    
    // Update players remaining
    this.updatePlayersRemaining();
  }
  
  updatePowerupDisplay() {
    // Clear current display
    this.powerupDisplay.innerHTML = '';
    
    // Get current powerup
    const powerup = this.gameState.localPlayer?.powerup;
    
    if (powerup) {
      // Create powerup element
      const powerupElement = document.createElement('div');
      powerupElement.className = 'powerup-item';
      
      // Add icon
      powerupElement.textContent = this.powerupIcons[powerup.effect] || '?';
      
      // Add tooltip
      powerupElement.title = `${powerup.type} - Press F to use`;
      
      // Add to display
      this.powerupDisplay.appendChild(powerupElement);
      
      // Add timer if powerup has duration
      if (powerup.duration) {
        const timerElement = document.createElement('div');
        timerElement.className = 'powerup-timer';
        timerElement.textContent = `${Math.ceil(powerup.duration)}s`;
        powerupElement.appendChild(timerElement);
      }
    }
  }
  
  updatePlayersRemaining() {
    // Count non-eliminated players
    let playersRemaining = 0;
    
    if (this.gameState.players) {
      playersRemaining = Object.values(this.gameState.players).filter(
        player => !player.eliminated
      ).length;
    }
    
    // Update display
    this.gameState.playersRemaining = playersRemaining;
    this.playersRemainingDisplay.textContent = `Players: ${playersRemaining}`;
  }
  
  showGameOver(isWinner) {
    this.gameOverScreen.classList.remove('hidden');
    
    if (isWinner) {
      this.gameOverText.textContent = 'You Won!';
    } else {
      this.gameOverText.textContent = 'Game Over!';
    }
  }
  
  hideGameOver() {
    this.gameOverScreen.classList.add('hidden');
  }
  
  showMessage(message, duration = 3000) {
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = 'game-message';
    messageElement.textContent = message;
    
    // Add to game UI
    document.getElementById('game-ui').appendChild(messageElement);
    
    // Remove after duration
    setTimeout(() => {
      messageElement.classList.add('fade-out');
      setTimeout(() => {
        messageElement.remove();
      }, 500);
    }, duration);
  }
}
