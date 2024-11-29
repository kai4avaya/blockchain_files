import * as THREE from 'three';
import indexDBOverlay from '../../memory/local/file_worker';
import { scene, markNeedsRender } from './create.js';
import gsap from 'gsap';

const MAX_KEYWORDS_PER_FILE = 400;
// Force Graph Constants
const FORCE_GRAPH_CONSTANTS = {
    // Force parameters
    REPULSION_FORCE: -30,
    LINK_DISTANCE: 50,
    DAMPING: 0.95,
    CENTER_FORCE: 0.0001,
    
    // Minimum distances for axes
    MIN_DISTANCE_X: 15,
    MIN_DISTANCE_Y: 8,
    MIN_DISTANCE_Z: 12,
    
    // Equilibrium parameters
    EQUILIBRIUM_THRESHOLD: 0.01,
    EQUILIBRIUM_FRAMES: 30,
    UPDATE_INTERVAL: 1000, // ms between updates when stable
    
    // Animation parameters
    MIN_FRAME_DELAY: 50,    // ms (20 FPS)
    ANIMATION_DURATION: 1.0, // seconds for GSAP
    
    // Hard stop parameters
    TOTAL_ANIMATION_TIME: 5000, // 5 seconds in ms
    
    // Node parameters
    INITIAL_SPREAD: 200,    // Initial position spread
    MAX_VELOCITY: 1.5,      // Maximum node velocity
    CLOSE_DISTANCE_THRESHOLD: 20,
    CLOSE_REPULSION_MULTIPLIER: 3,
    
    // Graph separation parameters
    GRAPH_SPACING: 300,     // Space between different file graphs
    GRAPHS_PER_ROW: 2,      // Number of graphs to place side by side
    GRAPH_INITIAL_SPREAD: 100  // Initial spread within each graph
};

// Add this function to generate a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Add this map to store colors for each file
const fileColors = new Map();

class ForceGraph {
    constructor(container) {
        this.nodes = [];
        this.links = [];
        this.nodeObjects = new Map();
        this.linkObjects = new Map();
        
        // Initialize with constants
        this.repulsionForce = FORCE_GRAPH_CONSTANTS.REPULSION_FORCE;
        this.linkDistance = FORCE_GRAPH_CONSTANTS.LINK_DISTANCE;
        this.damping = FORCE_GRAPH_CONSTANTS.DAMPING;
        this.centerForce = FORCE_GRAPH_CONSTANTS.CENTER_FORCE;
        
        this.minDistanceX = FORCE_GRAPH_CONSTANTS.MIN_DISTANCE_X;
        this.minDistanceY = FORCE_GRAPH_CONSTANTS.MIN_DISTANCE_Y;
        this.minDistanceZ = FORCE_GRAPH_CONSTANTS.MIN_DISTANCE_Z;
        
        this.equilibriumThreshold = FORCE_GRAPH_CONSTANTS.EQUILIBRIUM_THRESHOLD;
        this.equilibriumCount = 0;
        this.equilibriumFrames = FORCE_GRAPH_CONSTANTS.EQUILIBRIUM_FRAMES;
        this.updateInterval = FORCE_GRAPH_CONSTANTS.UPDATE_INTERVAL;
        this.lastUpdateTime = 0;
        this.isStable = false;
        
        // Add animation start time
        this.startTime = performance.now();
        
        this.group = new THREE.Group();
        scene.add(this.group);
        
        // Add file position tracking
        this.filePositions = new Map();
        this.fileCount = 0;
    }

    addNode(node) {
        // Calculate grid position for this file's graph
        if (!this.filePositions.has(node.fileId)) {
            const gridX = this.fileCount % FORCE_GRAPH_CONSTANTS.GRAPHS_PER_ROW;
            const gridY = Math.floor(this.fileCount / FORCE_GRAPH_CONSTANTS.GRAPHS_PER_ROW);
            this.filePositions.set(node.fileId, {
                x: gridX * FORCE_GRAPH_CONSTANTS.GRAPH_SPACING,
                y: gridY * FORCE_GRAPH_CONSTANTS.GRAPH_SPACING,
                z: 0
            });
            this.fileCount++;
        }

        const filePosition = this.filePositions.get(node.fileId);
        
        // Create text sprite for node
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Assign a color to the file if it doesn't have one
        if (!fileColors.has(node.fileId)) {
            fileColors.set(node.fileId, getRandomColor());
        }
        const nodeColor = fileColors.get(node.fileId);

        context.font = '24px Arial';
        context.fillStyle = nodeColor;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(node.name, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(12, 3, 1);
        
        // Position relative to file's grid position
        sprite.position.set(
            filePosition.x + (Math.random() - 0.5) * FORCE_GRAPH_CONSTANTS.GRAPH_INITIAL_SPREAD,
            filePosition.y + (Math.random() - 0.5) * FORCE_GRAPH_CONSTANTS.GRAPH_INITIAL_SPREAD,
            filePosition.z + (Math.random() - 0.5) * FORCE_GRAPH_CONSTANTS.GRAPH_INITIAL_SPREAD
        );
        
        sprite.userData = { 
            velocity: new THREE.Vector3(),
            node: node,
            fileId: node.fileId  // Store fileId for force calculations
        };
        
        this.group.add(sprite);
        this.nodeObjects.set(node.id, sprite);
        this.nodes.push(node);
    }

    addLink(source, target) {
        const material = new THREE.LineBasicMaterial({ 
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.3 
        });
        const geometry = new THREE.BufferGeometry();
        const line = new THREE.Line(geometry, material);
        
        line.userData = { source, target };
        this.group.add(line);
        this.links.push({ source, target, line });
    }

    updatePositions() {
        // Check if we've exceeded total animation time
        if (performance.now() - this.startTime > FORCE_GRAPH_CONSTANTS.TOTAL_ANIMATION_TIME) {
            this.isStable = true;
            return;
        }

        // Check if we should skip this update when system is stable
        const currentTime = performance.now();
        if (this.isStable && (currentTime - this.lastUpdateTime) < this.updateInterval) {
            return;
        }
        this.lastUpdateTime = currentTime;

        let maxForce = 0;
        const forces = new Map();
        
        this.nodes.forEach(node => {
            const obj = this.nodeObjects.get(node.id);
            if (!obj) return;
            
            const force = new THREE.Vector3();
            forces.set(node.id, force);

            // Only apply repulsion between nodes of the same file
            this.nodes.forEach(other => {
                if (node === other) return;
                if (node.fileId !== other.fileId) return; // Skip nodes from different files
                
                const otherObj = this.nodeObjects.get(other.id);
                if (!otherObj) return;

                const diff = obj.position.clone().sub(otherObj.position);
                const distance = diff.length() || 1;

                // Check and apply axis-specific repulsion
                const xDiff = Math.abs(diff.x);
                const yDiff = Math.abs(diff.y);
                const zDiff = Math.abs(diff.z);

                let repulsionStrength = this.repulsionForce;

                // Increase repulsion when nodes are too close on any axis
                if (xDiff < this.minDistanceX || 
                    yDiff < this.minDistanceY || 
                    zDiff < this.minDistanceZ) {
                    repulsionStrength *= 4;
                }

                // Additional axis-specific forces
                if (xDiff < this.minDistanceX) {
                    force.x += Math.sign(diff.x) * (this.minDistanceX - xDiff) * 0.5;
                }
                if (yDiff < this.minDistanceY) {
                    force.y += Math.sign(diff.y) * (this.minDistanceY - yDiff) * 0.5;
                }
                if (zDiff < this.minDistanceZ) {
                    force.z += Math.sign(diff.z) * (this.minDistanceZ - zDiff) * 0.5;
                }

                const baseForce = diff.normalize().multiplyScalar(repulsionStrength / (distance * distance));
                force.add(baseForce);
            });

            // Add centering force towards file's grid position
            const filePosition = this.filePositions.get(node.fileId);
            const centerForce = new THREE.Vector3(
                filePosition.x - obj.position.x,
                filePosition.y - obj.position.y,
                filePosition.z - obj.position.z
            ).multiplyScalar(this.centerForce);
            
            force.add(centerForce);
        });

        // Apply link forces
        this.links.forEach(link => {
            const sourceObj = this.nodeObjects.get(link.source);
            const targetObj = this.nodeObjects.get(link.target);
            if (!sourceObj || !targetObj) return;

            const diff = sourceObj.position.clone().sub(targetObj.position);
            const distance = diff.length();
            const force = diff.normalize().multiplyScalar((distance - this.linkDistance) * 0.05);
            
            forces.get(link.source)?.sub(force);
            forces.get(link.target)?.add(force);

            // Update link positions
            const positions = new Float32Array([
                sourceObj.position.x, sourceObj.position.y, sourceObj.position.z,
                targetObj.position.x, targetObj.position.y, targetObj.position.z
            ]);
            link.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            link.line.geometry.attributes.position.needsUpdate = true;
        });

        // Apply forces with GSAP
        this.nodes.forEach(node => {
            const obj = this.nodeObjects.get(node.id);
            if (!obj) return;

            const force = forces.get(node.id);
            if (!force) return;

            // Apply damping and velocity limits
            force.multiplyScalar(this.damping);
            force.clampLength(0, 1.0);

            maxForce = Math.max(maxForce, force.length());

            // Skip tiny movements (equilibrium check)
            if (force.length() < this.equilibriumThreshold) {
                return;
            }

            // Calculate target position
            const targetPosition = obj.position.clone().add(force);

            // Animate to new position with GSAP
            gsap.to(obj.position, {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                duration: 1.0,
                ease: "power1.out",
                onUpdate: () => {
                    markNeedsRender();
                }
            });
        });

        // Check for equilibrium
        if (maxForce < this.equilibriumThreshold) {
            this.equilibriumCount++;
            if (this.equilibriumCount >= this.equilibriumFrames) {
                this.isStable = true;
            }
        } else {
            this.equilibriumCount = 0;
            this.isStable = false;
        }
    }

    dispose() {
        this.nodeObjects.forEach(obj => {
            obj.material.dispose();
            obj.geometry.dispose();
        });
        this.links.forEach(link => {
            link.line.material.dispose();
            link.line.geometry.dispose();
        });
        scene.remove(this.group);
    }
}

export async function createTextNetwork() {
    try {
        const summaries = await indexDBOverlay.getAll('summaries');
        if (!summaries?.length) return null;

        const graph = new ForceGraph();
        const graphData = transformSummariesToGraph(summaries.slice(0, 50));

        // Add nodes and links
        graphData.nodes.forEach(node => graph.addNode(node));
        graphData.links.forEach(link => graph.addLink(link.source, link.target));

        let lastFrameTime = 0;
        const startTime = performance.now();

        function animate(currentTime) {
            // Stop animation after TOTAL_ANIMATION_TIME
            if (currentTime - startTime > FORCE_GRAPH_CONSTANTS.TOTAL_ANIMATION_TIME) {
                return;
            }

            const animationId = requestAnimationFrame(animate);
            
            // Skip frame if not enough time has passed
            if (currentTime - lastFrameTime < FORCE_GRAPH_CONSTANTS.MIN_FRAME_DELAY) {
                return;
            }
            
            lastFrameTime = currentTime;
            graph.updatePositions();
        }
        
        animate(0);

        // Return cleanup function
        return () => {
            cancelAnimationFrame(animationId);
            graph.dispose();
        };
    } catch (error) {
        console.error('Error in createTextNetwork:', error);
        return null;
    }
}

function transformSummariesToGraph(summaries, maxKeywordsPerFile = MAX_KEYWORDS_PER_FILE) {
    const nodes = [];
    const links = [];
    const nodeIds = new Map();
    let nodeIndex = 0;

    summaries.forEach(summary => {
        if (!summary?.keywords?.length) return;
        
        // Limit keywords per file
        const keywords = summary.keywords.slice(0, maxKeywordsPerFile);
        
        keywords.forEach(keyword => {
            if (!keyword) return;
            const nodeId = `${keyword}_${summary.fileId}`;
            
            if (!nodeIds.has(nodeId)) {
                nodeIds.set(nodeId, nodeIndex++);
                nodes.push({
                    id: nodeId,
                    name: keyword,
                    fileId: summary.fileId
                });
            }
        });

        // Create links between sequential keywords
        for (let i = 0; i < keywords.length - 1; i++) {
            const source = `${keywords[i]}_${summary.fileId}`;
            const target = `${keywords[i + 1]}_${summary.fileId}`;
            
            links.push({
                source,
                target,
                fileId: summary.fileId
            });
        }
    });

    console.log('Generated', nodes.length, 'nodes and', links.length, 'links');
    return { nodes, links };
} 