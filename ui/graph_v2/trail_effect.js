import * as THREE from 'three';
import { share3dDat, markNeedsRender } from './create.js';

class ParticleTrail {
  constructor(maxParticles = 1000) {
    const { scene } = share3dDat();
    
    // Create particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const opacities = new Float32Array(maxParticles);
    const sizes = new Float32Array(maxParticles);
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        attribute float opacity;
        attribute float size;
        varying float vOpacity;
        
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d) * vOpacity;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `
    });

    this.particles = new THREE.Points(particleGeometry, material);
    this.particles.frustumCulled = false;
    scene.add(this.particles);
    
    this.maxParticles = maxParticles;
    this.particleIndex = 0;
    this.lastTime = 0;
  }

  addParticle(position, size = 2) {
    const positions = this.particles.geometry.attributes.position;
    const opacities = this.particles.geometry.attributes.opacity;
    const sizes = this.particles.geometry.attributes.size;

    positions.setXYZ(
      this.particleIndex,
      position.x,
      position.y,
      position.z
    );
    opacities.setX(this.particleIndex, 1.0);
    sizes.setX(this.particleIndex, size);

    positions.needsUpdate = true;
    opacities.needsUpdate = true;
    sizes.needsUpdate = true;

    this.particleIndex = (this.particleIndex + 1) % this.maxParticles;
  }

  update(deltaTime) {
    const opacities = this.particles.geometry.attributes.opacity;
    
    for (let i = 0; i < this.maxParticles; i++) {
      opacities.array[i] *= Math.max(0, 1 - deltaTime * 2);
    }
    
    opacities.needsUpdate = true;
    markNeedsRender();
  }
}

// Singleton instance
let trailEffect = null;

export function createTrail(startPosition, endPosition, numParticles = 20) {
  if (!trailEffect) {
    trailEffect = new ParticleTrail();
  }

  const direction = endPosition.clone().sub(startPosition);
  const step = direction.clone().divideScalar(numParticles);

  for (let i = 0; i < numParticles; i++) {
    const pos = startPosition.clone().add(step.clone().multiplyScalar(i));
    trailEffect.addParticle(pos, 1.5);
  }

  return trailEffect;
}

export function updateTrails(deltaTime) {
  if (trailEffect) {
    trailEffect.update(deltaTime);
  }
}