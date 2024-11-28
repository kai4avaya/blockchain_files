import * as THREE from 'three';
import { gsap } from 'gsap';
import { findAllSpheres } from './snapshot.js';
import { share3dDat, markNeedsRender } from './create.js';
import { getFileSystem } from '../../memory/collaboration/file_colab';
import indexDBOverlay from '../../memory/local/file_worker';
import config from '../../configs/config.json';

const PARTICLE_COUNT = 100; // Increased for better visibility
const CURVE_AMOUNT = 0.2; // Amount of curve (0 to 1)

let isConnecting = false;
let connectedLines = new Map(); // Store connected lines

export async function initConnectLines() {
  console.log('🚀 Initializing network graph visualization...');
  if (!isConnecting) {
    isConnecting = true;
    try {
      await connectSimilarSpheres();
      console.log('✅ Network graph visualization completed');
    } catch (error) {
      console.error('❌ Error in network graph visualization:', error);
    } finally {
      isConnecting = false;
    }
  } else {
    console.log('⚠️ Network graph visualization already in progress');
  }
}

async function connectSimilarSpheres() {
  const { scene, nonBloomScene } = share3dDat();
  console.log('📊 Finding spheres in scenes...');
  const spheres = findAllSpheres([scene, nonBloomScene]);
  console.log(`Found ${spheres.length} spheres`);

  await indexDBOverlay.openDB(config.dbName);
  await indexDBOverlay.initializeDB(Object.keys(config.dbStores));

  const sphereKeywords = new Map();
  console.log('🔍 Fetching keywords for spheres...');
  
  // Fetch all keywords first
  const keywordPromises = spheres.map(async sphere => {
    if (sphere.userData?.id) {
      const keywords = await getKeywordsForSphere(sphere.userData.id);
      sphereKeywords.set(sphere.userData.id, keywords);
    }
  });
  
  await Promise.all(keywordPromises);

  // Create all connections
  const connectionPromises = [];
  let connectionCount = 0;
  
  for (let i = 0; i < spheres.length; i++) {
    for (let j = i + 1; j < spheres.length; j++) {
      const sphere1 = spheres[i];
      const sphere2 = spheres[j];
      
      if (sphere1.userData?.id && sphere2.userData?.id) {
        const keywords1 = sphereKeywords.get(sphere1.userData.id);
        const keywords2 = sphereKeywords.get(sphere2.userData.id);
        
        if (!keywords1 || !keywords2) continue;
        
        const commonKeywords = keywords1.filter(keyword => keywords2.includes(keyword));
        
        if (commonKeywords.length > 0) {
          console.log(`Found ${commonKeywords.length} connections between spheres ${sphere1.userData.id} and ${sphere2.userData.id}`);
          
          // Create all particle lines for this sphere pair with 3D distribution
          for (let k = 0; k < commonKeywords.length; k++) {
            const keyword = commonKeywords[k];
            const angleStep = (2 * Math.PI) / commonKeywords.length;
            const radius = 0.2; // Base radius for the distribution
            
            // Calculate 3D offset
            const offset = radius * Math.cos(k * angleStep);
            const heightOffset = radius * Math.sin(k * angleStep);
            
            connectionPromises.push(animateParticleLine(
              sphere1, 
              sphere2, 
              keyword, 
              offset, 
              heightOffset,
              k
            ));
            connectionCount++;
          }
        }
      }
    }
  }

  // Animate all lines simultaneously
  await Promise.all(connectionPromises);
  console.log(`✅ Created ${connectionCount} connections between spheres`);
  markNeedsRender();
}

async function getKeywordsForSphere(sphereId) {
  try {
    const fileSystem = getFileSystem();
    const fileData = await fileSystem.getItem(sphereId, 'file');

    if (!fileData) {
      console.warn(`⚠️ File data not found for sphere ${sphereId}`);
      return [];
    }

    const summaries = await indexDBOverlay.getData('summaries');
    const summaryEntry = summaries.find(entry => entry.fileId === sphereId);

    if (summaryEntry && summaryEntry.keywords) {
      return summaryEntry.keywords;
    } else {
      console.warn(`⚠️ No keywords found for sphere ${sphereId}`);
      return [];
    }
  } catch (error) {
    console.error(`❌ Error getting keywords for sphere ${sphereId}:`, error);
    return [];
  }
}

function createParticleLine(sphere1, sphere2, keyword, offset = 0, heightOffset = 0, index = 0) {
  const { scene } = share3dDat();
  
  const midPoint = getMiddlePoint(sphere1.position, sphere2.position, offset, heightOffset, index);
  const curve = new THREE.QuadraticBezierCurve3(
    sphere1.position,
    midPoint,
    sphere2.position
  );

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  // Initialize all positions at the start point
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const idx = i * 3;
    positions[idx] = sphere1.position.x;
    positions[idx + 1] = sphere1.position.y;
    positions[idx + 2] = sphere1.position.z;
    
    // Create unique colors based on keyword
    const hue = Math.abs(keyword.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
    const color = new THREE.Color().setHSL(hue / 360, 0.8, 0.6);
    colors[idx] = color.r;
    colors[idx + 1] = color.g;
    colors[idx + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });

  const line = new THREE.Points(geometry, material);
  line.userData = {
    type: 'connection',
    sphere1Id: sphere1.userData.id,
    sphere2Id: sphere2.userData.id,
    keyword: keyword,
    offset: offset,
    heightOffset: heightOffset,
    index: index
  };

  // Ensure the line is visible in all layers
  line.layers.enableAll();
  
  scene.add(line);
  const connectionKey = `${sphere1.userData.id}-${sphere2.userData.id}-${keyword}-${index}`;
  connectedLines.set(connectionKey, line);
  
  return line;
}

function getMiddlePoint(p1, p2, offset = 0, heightOffset = 0, index = 0) {
  const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const distance = p1.distanceTo(p2);
  
  // Add base curve
  midPoint.y += CURVE_AMOUNT * distance;
  
  // Calculate 3D offset using spherical coordinates
  const direction = new THREE.Vector3().subVectors(p2, p1);
  const angle = (index * Math.PI * 0.5) + (offset * Math.PI * 0.2); // Distribute around the connection line
  
  // Create perpendicular vectors for 3D distribution
  const perpX = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  const perpY = new THREE.Vector3(
    -direction.y * direction.x,
    direction.x * direction.x + direction.z * direction.z,
    -direction.y * direction.z
  ).normalize();
  
  // Apply 3D offset
  midPoint.add(perpX.multiplyScalar(Math.cos(angle) * offset * distance));
  midPoint.add(perpY.multiplyScalar(Math.sin(angle) * offset * distance));
  midPoint.y += heightOffset * distance; // Additional height variation
  
  return midPoint;
}

async function animateParticleLine(sphere1, sphere2, keyword, offset = 0, heightOffset = 0, index = 0) {
    const line = createParticleLine(sphere1, sphere2, keyword, offset, heightOffset, index);
    const material = line.material;
    const geometry = line.geometry;
    const positions = geometry.attributes.position.array;
    
    // Set initial state
    material.opacity = 0;
    
    // Calculate curve once
    const curve = new THREE.QuadraticBezierCurve3(
        sphere1.position,
        getMiddlePoint(sphere1.position, sphere2.position, offset, heightOffset, index),
        sphere2.position
    );

    return new Promise(resolve => {
        // Fade in and maintain opacity
        gsap.to(material, {
            opacity: 0.8,
            duration: 1.0,
            ease: "power2.out"
        });

        gsap.to({}, {
            duration: 1.5,
            onUpdate: function() {
                const progress = this.progress();
                for (let i = 0; i < PARTICLE_COUNT; i++) {
                    const delay = i / PARTICLE_COUNT * 0.8;
                    const particleProgress = Math.max(0, Math.min(1, (progress - delay) * 1.5));
                    
                    const point = curve.getPoint(particleProgress);
                    const idx = i * 3;
                    positions[idx] = point.x;
                    positions[idx + 1] = point.y;
                    positions[idx + 2] = point.z;
                }
                geometry.attributes.position.needsUpdate = true;
                markNeedsRender();
            },
            onComplete: () => {
                // Ensure final positions and opacity are set
                material.opacity = 0.8;
                material.needsUpdate = true;
                
                for (let i = 0; i < PARTICLE_COUNT; i++) {
                    const t = i / (PARTICLE_COUNT - 1);
                    const point = curve.getPoint(t);
                    const idx = i * 3;
                    positions[idx] = point.x;
                    positions[idx + 1] = point.y;
                    positions[idx + 2] = point.z;
                }
                geometry.attributes.position.needsUpdate = true;
                markNeedsRender();
                resolve();
            }
        });
    });
}

export function updateConnectedLines() {
  connectedLines.forEach((line, key) => {
    const [sphere1Id, sphere2Id, keyword, index] = key.split('-');
    const { scene } = share3dDat();
    
    let sphere1, sphere2;
    scene.traverse((object) => {
      if (object.userData?.id === sphere1Id) sphere1 = object;
      if (object.userData?.id === sphere2Id) sphere2 = object;
    });

    if (!sphere1 || !sphere2) {
      console.warn('Could not find connected spheres:', sphere1Id, sphere2Id);
      return;
    }

    const offset = line.userData.offset;
    const heightOffset = line.userData.heightOffset;
    const indexNum = parseInt(index) || 0;

    // Calculate new curve with 3D distribution
    const curve = new THREE.QuadraticBezierCurve3(
      sphere1.position,
      getMiddlePoint(sphere1.position, sphere2.position, offset, heightOffset, indexNum),
      sphere2.position
    );

    // Update particle positions
    const positions = line.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / (PARTICLE_COUNT - 1);
      const point = curve.getPoint(t);
      const idx = i * 3;
      positions[idx] = point.x;
      positions[idx + 1] = point.y;
      positions[idx + 2] = point.z;
    }

    line.geometry.attributes.position.needsUpdate = true;
    line.material.needsUpdate = true;
  });

  markNeedsRender('immediate');
}

export function removeConnectedLines() {
  const { scene } = share3dDat();
  connectedLines.forEach((line) => {
    scene.remove(line);
  });
  connectedLines.clear();
  markNeedsRender();
}