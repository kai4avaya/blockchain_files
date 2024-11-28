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

  // Create a map of sphere userIds to their keywords
  const sphereKeywords = new Map();
  console.log('🔍 Fetching keywords for spheres...');
  
  for (const sphere of spheres) {
    if (sphere.userData && sphere.userData.id) {
      const keywords = await getKeywordsForSphere(sphere.userData.id);
      console.log(`Keywords for sphere ${sphere.userData.id}:`, keywords);
      sphereKeywords.set(sphere.userData.id, keywords);
    }
  }

  // Compare each pair of spheres
  console.log('🔗 Creating connections between similar spheres...');
  let connectionCount = 0;
  
  for (let i = 0; i < spheres.length; i++) {
    for (let j = i + 1; j < spheres.length; j++) {
      const sphere1 = spheres[i];
      const sphere2 = spheres[j];
      
      if (sphere1.userData && sphere2.userData && 
          sphere1.userData.id && sphere2.userData.id) {
        const keywords1 = sphereKeywords.get(sphere1.userData.id);
        const keywords2 = sphereKeywords.get(sphere2.userData.id);
        
        if (!keywords1 || !keywords2) {
          console.warn('⚠️ Missing keywords for sphere:', 
            !keywords1 ? sphere1.userData.id : sphere2.userData.id);
          continue;
        }
        
        const commonKeywords = keywords1.filter(keyword => keywords2.includes(keyword));
        
        if (commonKeywords.length > 0) {
          console.log(`Found connection between spheres ${sphere1.userData.id} and ${sphere2.userData.id}`);
          console.log('Common keywords:', commonKeywords);
          await animateParticleLine(sphere1, sphere2, commonKeywords[0]);
          connectionCount++;
        }
      }
    }
  }

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

function createParticleLine(sphere1, sphere2, keyword) {
  const { scene } = share3dDat();
  console.log('Creating particle line between', sphere1.userData.id, 'and', sphere2.userData.id);

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

    // Set color to a bright blue
    colors[i * 3] = 0.3;     // R
    colors[i * 3 + 1] = 0.6; // G
    colors[i * 3 + 2] = 1.0; // B
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });

  const line = new THREE.Points(geometry, material);
  line.userData = {
    type: 'connection',
    sphere1Id: sphere1.userData.id,
    sphere2Id: sphere2.userData.id,
    keyword: keyword
  };

  // Add to scene and store in the map
  scene.add(line);
  connectedLines.set(`${sphere1.userData.id}-${sphere2.userData.id}`, line);
  
  // Ensure the scene is re-rendered
  markNeedsRender('immediate');
  
  console.log('Created particle line:', line);
  return line;
}

function getMiddlePoint(p1, p2) {
  const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  // Increase the curve amount for more pronounced arcing
  const distance = p1.distanceTo(p2);
  midPoint.y += CURVE_AMOUNT * distance;
  return midPoint;
}

async function animateParticleLine(sphere1, sphere2, keyword) {
    console.log('Animating particle line between', sphere1.userData.id, 'and', sphere2.userData.id);
    
    const line = createParticleLine(sphere1, sphere2, keyword);
    const material = line.material;
    const geometry = line.geometry;
    const positions = geometry.attributes.position.array;
    
    // Store original positions
    const originalPositions = positions.slice();
    
    // Set all positions to start from sphere1
    for (let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
        positions[i] = sphere1.position.x;
        positions[i + 1] = sphere1.position.y;
        positions[i + 2] = sphere1.position.z;
    }
    
    geometry.attributes.position.needsUpdate = true;
    material.opacity = 0;

    // Calculate the curve points
    const curve = new THREE.QuadraticBezierCurve3(
        sphere1.position,
        getMiddlePoint(sphere1.position, sphere2.position),
        sphere2.position
    );

    // Animate particles flowing from sphere1 to sphere2
    await new Promise(resolve => {
        gsap.to(material, {
            opacity: 0.8,
            duration: 0.5,
            ease: "power2.out"
        });

        gsap.to({}, {
            duration: 2,
            onUpdate: function() {
                const progress = this.progress();
                for (let i = 0; i < PARTICLE_COUNT; i++) {
                    const delay = i / PARTICLE_COUNT; // Stagger the particles
                    const particleProgress = Math.max(0, Math.min(1, (progress - delay) * 1.5));
                    
                    // Get point along the curve
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
                // Ensure final positions match exactly
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
    const [sphere1Id, sphere2Id] = key.split('-');
    const { scene } = share3dDat();
    
    // Find the spheres in the scene
    let sphere1, sphere2;
    scene.traverse((object) => {
      if (object.userData?.id === sphere1Id) sphere1 = object;
      if (object.userData?.id === sphere2Id) sphere2 = object;
    });

    if (!sphere1 || !sphere2) {
      console.warn('Could not find connected spheres:', sphere1Id, sphere2Id);
      return;
    }

    // Calculate new curve
    const curve = new THREE.QuadraticBezierCurve3(
      sphere1.position,
      getMiddlePoint(sphere1.position, sphere2.position),
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