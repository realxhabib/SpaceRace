// basicAsteroid.js - Fallback asteroid model generator
// This file provides a function to create basic asteroid meshes when the GLB models can't be loaded

/**
 * Creates a basic asteroid mesh using Three.js primitives
 * @param {object} THREE - The Three.js library instance
 * @param {number} size - The size multiplier for the asteroid
 * @param {number} variant - A number 0-2 to select different geometry variants
 * @returns {object} A Three.js mesh representing a basic asteroid
 */
export function createBasicAsteroid(THREE, size = 1, variant = 0) {
  // Select geometry based on variant
  let geometry;
  switch (variant % 3) {
    case 0:
      geometry = new THREE.IcosahedronGeometry(size, 0); // Simplest variant
      break;
    case 1:
      geometry = new THREE.DodecahedronGeometry(size, 0); // Medium complexity
      break;
    case 2:
      geometry = new THREE.OctahedronGeometry(size, 1); // Most complex variant
      break;
  }
  
  // Create a material with a rocky appearance
  const material = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true
  });
  
  // Create the mesh
  const mesh = new THREE.Mesh(geometry, material);
  
  // Add random rotation
  mesh.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  
  // Add a light to make it more visible
  const light = new THREE.PointLight(0xff4500, 0.2, 3);
  mesh.add(light);
  
  return mesh;
}

/**
 * Creates multiple asteroid meshes as a group
 * @param {object} THREE - The Three.js library instance
 * @param {number} count - Number of asteroid variants to create
 * @returns {object} A Three.js Group containing multiple asteroid meshes
 */
export function createAsteroidGroup(THREE, count = 3) {
  const group = new THREE.Group();
  
  for (let i = 0; i < count; i++) {
    const asteroid = createBasicAsteroid(THREE, 1, i);
    asteroid.visible = false; // Hidden by default
    asteroid.position.set(0, 0, 0);
    group.add(asteroid);
  }
  
  return group;
} 