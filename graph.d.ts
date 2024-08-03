// graph.d.ts

// Import the necessary types from Three.js and MobX
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
// import fileStore from './memory/stores/fileStore';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
// import { IReactionDisposer } from 'mobx';
// import { Node as GraphNode, Store as GraphStore } from './memory/stores/graphStore';
// import { File as FileStore, Store as FileStoreType } from './memory/stores/fileStore';

// Declare the scene, camera, controls, renderer, and dragControls variables
declare let scene: THREE.Scene;
declare let camera: THREE.PerspectiveCamera;
declare let controls: OrbitControls;
declare let renderer: THREE.WebGLRenderer;
declare let dragControls: DragControls;
declare const nodes: Map<string, Node>; // Use a Map to keep track of nodes by their ID

// Declare the types for the parameters of the functions
interface Node {
    id: string;
    file: any;
    size: number;
    geometry: THREE.SphereGeometry;
    material: THREE.MeshBasicMaterial;
    x: number;
    y: number;
    z: number;
    color: number;
    mesh: THREE.Mesh;
}

// Initialize the scene, camera, controls, and renderer
export function graphInit(initScene: THREE.Scene, initCamera: THREE.PerspectiveCamera): void;

// Function to add a node to the graph
export function addNode(
    id: string,
    file: any,
    x?: number,
    y?: number,
    z?: number,
    color?: number
): void;

// Function to update the graph based on the nodes
export function updateGraph(nodes: any): void;

export function isRendererReady(): boolean;
