import * as THREE from 'three';
import { gsap } from 'gsap';
import { findAllSpheres } from './snapshot.js';
import { share3dDat, markNeedsRender } from './create.js';
import { getFileSystem } from '../../memory/collaboration/file_colab';
import indexDBOverlay from '../../memory/local/file_worker';

const PARTICLE_COUNT = 20; // Number of particles per line
const CURVE_AMOUNT = 0.2; // Amount of curve (0 to 1)

let isConnecting = false;

export async function initConnectLines() {

    if (!isConnecting) {
      isConnecting = true;
      await connectSimilarSpheres();
      isConnecting = false;
    }
}

async function connectSimilarSpheres() {
  const { scene, nonBloomScene } = share3dDat();
  const spheres = findAllSpheres([scene, nonBloomScene]);

  // Initialize IndexedDB
  await indexDBOverlay.openDB('fileGraphDB');
  await indexDBOverlay.openDB('summarizationDB', 2);

  // Create a map of sphere userIds to their keywords
  const sphereKeywords = new Map();
  for (const sphere of spheres) {
    if (sphere.userData && sphere.userData.id) {
      const keywords = await getKeywordsForSphere(sphere.userData.id);
      sphereKeywords.set(sphere.userData.id, keywords);
    }
  }

  // Compare each pair of spheres
  for (let i = 0; i < spheres.length; i++) {
    for (let j = i + 1; j < spheres.length; j++) {
      const sphere1 = spheres[i];
      const sphere2 = spheres[j];
      
      if (sphere1.userData && sphere2.userData && 
          sphere1.userData.id && sphere2.userData.id) {
        const keywords1 = sphereKeywords.get(sphere1.userData.id);
        const keywords2 = sphereKeywords.get(sphere2.userData.id);
        
        const commonKeywords = keywords1.filter(keyword => keywords2.includes(keyword));
        
        if (commonKeywords.length > 0) {
          const keyword = commonKeywords[0];
          await animateParticleLine(sphere1, sphere2, keyword);
        }
      }
    }
  }

  markNeedsRender();
}

async function getKeywordsForSphere(sphereId) {
  try {
    const fileSystem = getFileSystem();
    const fileData = await fileSystem.getItem(sphereId, 'file');

    if (!fileData) {
      console.warn(`File data not found for sphere ${sphereId}`);
      return [];
    }

    const summaries = await indexDBOverlay.getData('summaries', 'summarizationDB');
    const summaryEntry = summaries.find(entry => entry.fileId === sphereId);

    if (summaryEntry && summaryEntry.keywords) {
      return summaryEntry.keywords;
    } else {
      console.warn(`No keywords found for sphere ${sphereId}`);
      return [];
    }
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return [];
  }
}

function createParticleLine(sphere1, sphere2, keyword) {
  const curve = new THREE.QuadraticBezierCurve3(
    sphere1.position,
    getMiddlePoint(sphere1.position, sphere2.position),
    sphere2.position
  );

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / (PARTICLE_COUNT - 1);
    const point = curve.getPoint(t);
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;

    const color = getColorForKeyword(keyword);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    sizeAttenuation: false
  });

  return new THREE.Points(geometry, material);
}

async function animateParticleLine(sphere1, sphere2, keyword) {
  const { scene } = share3dDat();
  const line = createParticleLine(sphere1, sphere2, keyword);
  scene.add(line);

  const originalPositions = line.geometry.attributes.position.array.slice();
  const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

  // Set all positions to the start point initially
  for (let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
    targetPositions[i] = originalPositions[0];
    targetPositions[i + 1] = originalPositions[1];
    targetPositions[i + 2] = originalPositions[2];
  }

  line.geometry.setAttribute('position', new THREE.BufferAttribute(targetPositions, 3));

  return new Promise((resolve) => {
    gsap.to(targetPositions, {
      endArray: originalPositions,
      duration: 2,
      ease: "power1.inOut",
      onUpdate: () => {
        line.geometry.attributes.position.needsUpdate = true;
        markNeedsRender();
      },
      onComplete: resolve
    });
  });
}

function getMiddlePoint(point1, point2) {
  const midPoint = new THREE.Vector3().addVectors(point1, point2).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(point2, point1).normalize();
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  
  const randomOffset = (Math.random() - 0.5) * 2;
  return midPoint.add(perpendicular.multiplyScalar(CURVE_AMOUNT * randomOffset * point1.distanceTo(point2)));
}

function getColorForKeyword(keyword) {
  // Implement a color mapping for keywords
  // For now, we'll return a random bright color
  return new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
}