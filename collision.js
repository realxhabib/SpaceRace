// collision.js - Handle collision detection and response
import * as THREE from 'three';

export class CollisionSystem {
  constructor(scene) {
    this.scene = scene;
    this.colliders = new Map(); // Map of object types to arrays of objects
  }

  // Register an object for collision detection
  register(object, type) {
    if (!this.colliders.has(type)) {
      this.colliders.set(type, []);
    }
    this.colliders.get(type).push(object);
  }

  // Remove an object from collision detection
  unregister(object, type) {
    if (this.colliders.has(type)) {
      const objects = this.colliders.get(type);
      const index = objects.indexOf(object);
      if (index !== -1) {
        objects.splice(index, 1);
      }
    }
  }

  // Check collisions between two types of objects
  checkCollisions(typeA, typeB, callback) {
    const objectsA = this.colliders.get(typeA) || [];
    const objectsB = this.colliders.get(typeB) || [];

    for (const objA of objectsA) {
      for (const objB of objectsB) {
        // Skip if same object
        if (objA === objB) continue;

        // Check if both objects have bounding spheres
        if (objA.boundingSphere && objB.boundingSphere) {
          if (objA.boundingSphere.intersectsSphere(objB.boundingSphere)) {
            callback(objA, objB);
          }
        }
      }
    }
  }

  // Update all registered objects' bounding spheres
  update() {
    for (const [type, objects] of this.colliders) {
      for (const obj of objects) {
        if (obj.boundingSphere && obj.position) {
          obj.boundingSphere.center.copy(obj.position);
        }
      }
    }
  }

  // Calculate collision response between two objects
  handleCollision(objA, objB) {
    // Get the collision normal
    const normal = objB.position.clone().sub(objA.position).normalize();
    
    // Calculate relative velocity
    const relativeVelocity = objB.velocity.clone().sub(objA.velocity);
    
    // Calculate relative velocity along the normal
    const velocityAlongNormal = relativeVelocity.dot(normal);
    
    // Don't resolve if objects are moving apart
    if (velocityAlongNormal > 0) return;
    
    // Calculate restitution (bounciness)
    const restitution = 0.8;
    
    // Calculate impulse scalar
    const j = -(1 + restitution) * velocityAlongNormal;
    const impulse = normal.multiplyScalar(j);
    
    // Apply impulse to both objects
    const massA = objA.mass || 1;
    const massB = objB.mass || 1;
    const totalMass = massA + massB;
    
    objA.velocity.sub(impulse.clone().multiplyScalar(1 / massA));
    objB.velocity.add(impulse.clone().multiplyScalar(1 / massB));
    
    // Apply damage if objects have health
    if (objA.damage && objB.getHealth) {
      objB.damage(objA.damageValue || 10);
    }
    if (objB.damage && objA.getHealth) {
      objA.damage(objB.damageValue || 10);
    }
  }

  // Clear all registered objects
  reset() {
    this.colliders.clear();
  }
}
