import * as THREE from 'three';
import { share3dDat } from '../../ui/graph_v2/create';
import MouseOverlayCanvas from '../../ui/graph_v2/MouseOverlayCanvas';

class MousePositionManager {
  private static instance: MousePositionManager | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private renderer: THREE.Renderer | null = null;
  private mouseOverlay: MouseOverlayCanvas | null = null;
  private isTracking: boolean = false;

  private constructor() {}

  static getInstance(): MousePositionManager {
    if (!MousePositionManager.instance) {
      MousePositionManager.instance = new MousePositionManager();
    }
    return MousePositionManager.instance;
  }

  initialize(): void {
    const { scene, camera, renderer } = share3dDat();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    if (!this.scene || !this.camera || !this.renderer) {
      console.error('Failed to initialize MousePositionManager: Missing required objects');
    } else {
      console.log('MousePositionManager initialized successfully');
      this.mouseOverlay = new MouseOverlayCanvas(this.renderer.domElement.parentElement);
    }
  }

  startTracking(): void {
    this.isTracking = true;
    console.log('Mouse position tracking started');
  }

  stopTracking(): void {
    this.isTracking = false;
    this.mouseOverlay?.clear();
    console.log('Mouse position tracking stopped');
  }

  updateMousePosition(peerId: string, x: number, y: number): void {
    if (!this.isTracking || !this.mouseOverlay) return;

    this.mouseOverlay.updateMousePosition(peerId, x, y);
    console.log(`Updated mouse position for peer ${peerId}: (${x}, ${y})`);
  }

  removePeerCursor(peerId: string): void {
    this.mouseOverlay?.removePeerCursor(peerId);
    console.log(`Removed cursor for peer ${peerId}`);
  }
}

export default MousePositionManager;