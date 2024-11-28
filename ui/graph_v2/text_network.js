import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import indexDBOverlay from '../../memory/local/file_worker';
import { scene, nonBloomScene, markNeedsRender } from './create.js';

export async function createTextNetwork() {
    // Get summaries from IndexDB
    const summaries = await indexDBOverlay.getAll('summaries');
    
    // Create and configure the graph with transparent background
    const Graph = ForceGraph3D({
        // Initial configuration options
        alpha: true,           // Enable transparency
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance"
    })(document.getElementById('text-network-container'))
        .backgroundColor('rgba(0,0,0,0)') // Make background transparent
        .nodeAutoColorBy('fileId')
        .nodeThreeObject(node => {
            const sprite = new SpriteText(node.id.split('_')[0]); // Only show keyword, not fileId
            sprite.material.depthWrite = false;
            sprite.color = node.color;
            sprite.textHeight = 8;
            sprite.backgroundColor = 'rgba(0,0,0,0.2)'; // Semi-transparent background
            return sprite;
        })
        .linkOpacity(0.3)
        .linkWidth(0.5)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleWidth(0.5)
        .onNodeClick(node => {
            // Center/zoom on node
            Graph.centerAt(node.x, node.y, node.z, 1000);
            Graph.zoom(1.5, 1000);
        });

    // Adjust force simulation parameters
    Graph.d3Force('charge')
        .strength(-120)
        .distanceMax(300);
    
    Graph.d3Force('link')
        .distance(100);

    // Transform and set data
    const graphData = transformSummariesToGraph(summaries);
    Graph.graphData(graphData);
    
    // Force a few simulation ticks to settle initial positions
    for (let i = 0; i < 100; i++) {
        Graph.tickFrame();
    }
    
    // Add cleanup function
    return () => {
        const container = document.getElementById('text-network-container');
        container.innerHTML = ''; // Clear the container
        Graph.dispose();
    };
}

function transformSummariesToGraph(summaries) {
    const nodes = [];
    const links = [];
    const nodeIds = new Set();

    summaries.forEach(summary => {
        if (!summary.keywords) return;
        
        // Add nodes for each keyword
        summary.keywords.forEach(keyword => {
            const nodeId = `${keyword}_${summary.fileId}`;
            if (!nodeIds.has(nodeId)) {
                nodeIds.add(nodeId);
                nodes.push({
                    id: nodeId,
                    name: keyword,
                    fileId: summary.fileId,
                    val: 1
                });
            }
        });

        // Create links between keywords from the same file
        for (let i = 0; i < summary.keywords.length; i++) {
            for (let j = i + 1; j < summary.keywords.length; j++) {
                links.push({
                    source: `${summary.keywords[i]}_${summary.fileId}`,
                    target: `${summary.keywords[j]}_${summary.fileId}`,
                    fileId: summary.fileId
                });
            }
        }
    });

    return { nodes, links };
} 