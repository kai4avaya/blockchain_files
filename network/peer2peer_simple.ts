import { Peer, DataConnection } from 'peerjs';
// import { sceneState } from '../memory/collaboration/scene_colab';
import MousePositionManager from '../memory/collaboration/mouse_colab';

interface SceneState {
  getSerializableState: () => any;
  syncWithPeer: (state: any) => void;
  updateObject: (objectState: any) => void;
}

interface MouseOverlayCanvas {
  updateMousePosition: (peerId: string, x: number, y: number) => void;
  removePeerCursor: (peerId: string) => void;
}
interface MousePosition {
  x: number;
  y: number;
}

class P2PSync {
  private static instance: P2PSync | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private sceneState: SceneState | null = null;
  private knownPeers: Set<string> = new Set();
  private heartbeatInterval: number = 5000; // Heartbeat every 5 seconds
  private heartbeatTimer: number | null = null;
  private reconnectInterval: number = 10000;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  // private mousePositions: Map<string, MousePosition> = new Map();
  private mousePositionManager: MousePositionManager | null = null;
  private mouseOverlay: MouseOverlayCanvas | null = null

  private constructor() {}

  static getInstance(): P2PSync {
    if (!P2PSync.instance) {
      P2PSync.instance = new P2PSync();
    }
    return P2PSync.instance;
  }

 
  initialize(userId: string): void {
    // this.sceneState = sceneState;
    this.loadKnownPeers();

    const storedPeerId = localStorage.getItem('myPeerId');
    const peerId = storedPeerId || `${userId}-${Date.now()}`;
    this.peer = new Peer(peerId);

    this.peer.on('open', (id) => {
      console.log('My peer ID is:', id);
      localStorage.setItem('myPeerId', id);
      updateStatus(`Initialized with peer ID: ${id}`);
      this.updateUserIdInput(id);  // Update the user ID input instead

      this.knownPeers.forEach((peerId) => this.connectToSpecificPeer(peerId));
      this.startHeartbeat();
    });

    this.peer.on('connection', (conn) => {
      if (conn.open) {
        this.handleConnection(conn);
      } else {
        conn.on('open', () => this.handleConnection(conn));
      }
    });

    this.peer.on('disconnected', () => {
      console.log('Peer disconnected');
      updateStatus('Peer disconnected. Attempting to reconnect...');
      if (this.peer && !this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
      updateStatus('Peer connection closed');
      this.stopHeartbeat();
    });

    this.peer.on('error', (error) => {
      console.error('PeerJS error:', error);
      updateStatus(`PeerJS error: ${error.type}`);
    });
  }
  setMouseOverlay(overlay: MouseOverlayCanvas): void {
    this.mouseOverlay = overlay;
    console.log('MouseOverlayCanvas set in P2PSync');
  }

  setMousePositionManager(manager: MousePositionManager): void {
    this.mousePositionManager = manager;
    console.log('MousePositionManager set in P2PSync');
  }

  // updateMousePosition(x: number, y: number): void {
  //   if (this.connections.size === 0 || !this.mousePositionManager) return;
  //   if (!this.peer) return;

  //   const myPeerId = this.peer.id;
  //   this.mousePositionManager.updateMousePosition(myPeerId, x, y);
  //   this.broadcastMousePosition(x, y);
  //   // console.log(`Broadcasting mouse position: (${x}, ${y})`);
  // }

  updateMousePosition(x: number, y: number): void {
    console.log("this.mouseOverlay, this.peer", this.mouseOverlay, this.peer)
    if (this.connections.size === 0 || !this.mouseOverlay || !this.peer) return;

    console.log(`Sending mouse position: (${x}, ${y})`);
    this.broadcastMousePosition(x, y);
  }

  private broadcastMousePosition(x: number, y: number): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        console.log(`Broadcasting mouse position to peer ${conn.peer}: (${x}, ${y})`);
        conn.send({ type: 'mouse_position', data: { x, y } });
      }
    });
  }

  setSceneState(sceneState: SceneState): void {
    this.sceneState = sceneState;
  }

  connectToSpecificPeer(peerId: string): void {
    if (!this.peer || this.peer.destroyed) {
      console.error('Peer object is undefined or destroyed. Cannot connect.');
      updateStatus('Error: Peer not initialized or destroyed');
      return;
    }
    if (this.connections.has(peerId) || peerId === this.peer.id) {
      console.log('Already connected to peer or attempting to connect to self.');
      updateStatus('Already connected or trying to connect to self');
      return;
    }
    console.log(`Attempting to connect to peer: ${peerId}`);
    updateStatus(`Attempting to connect to peer: ${peerId}`);

    const conn = this.peer.connect(peerId, { reliable: true });

    conn.on('open', () => {
      console.log(`Connection to peer ${peerId} opened`);
      this.handleConnection(conn);
      this.clearReconnectTimer(peerId);
    });

    conn.on('error', (err) => {
      console.error(`Connection error with peer ${peerId}:`, err);
      updateStatus(`Connection error with peer ${peerId}: ${err.message}`);
      this.scheduleReconnect(peerId);
    });
  }

  isConnected(): boolean {
    return this.connections.size > 0;
  }

  private clearReconnectTimer(peerId: string): void {
    const timer = this.reconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(peerId);
    }
  }


  private handleConnection(conn: DataConnection): void {
    console.log('Handling connection for peer:', conn.peer);
    this.connections.set(conn.peer, conn);
    updateStatus(`Connected to peer: ${conn.peer}`);
    this.saveKnownPeer(conn.peer);
  
    // Send current state immediately after connection
    this.sendCurrentState(conn);
    // Send known peers to the connected peer
    conn.send({ type: 'known_peers', data: Array.from(this.knownPeers) });
  
  
    conn.on('data', (data: { type: string; data: any }) => {
      switch (data.type) {
        case 'request_current_state':
          this.sendCurrentState(conn);
          break;
        case 'full_state':
          console.log('Received full state from peer. Syncing...');
          console.log('Full state data:', data.data);
          this.sceneState?.syncWithPeer(data.data);
          break;
        case 'update':
          console.log('Received update from peer. Updating objects...', data.data);
          this.sceneState?.syncWithPeer(data.data);
          break;
        case 'mouse_position':
            console.log(`Received mouse position from peer ${conn.peer}: (${data.data.x}, ${data.data.y})`);
            if (this.mouseOverlay) {
              this.mouseOverlay.updateMousePosition(conn.peer, data.data.x, data.data.y);
            }
            break;
        case 'known_peers':
              this.handleKnownPeers(data.data);
              break;
  
        default:
          console.warn(`Received unknown data type: ${data.type} from peer: ${conn.peer}`);
      }
    });
  
    conn.on('close', () => {
      console.log(`Connection closed with peer: ${conn.peer}`);
      this.connections.delete(conn.peer);
      updateStatus(`Disconnected from peer: ${conn.peer}`);
      this.scheduleReconnect(conn.peer);
      this.updateConnectionStatus();
      if (this.mouseOverlay) {
        this.mouseOverlay.removePeerCursor(conn.peer);
      }
      
    });
  
    conn.on('error', (err) => {
      console.error(`Connection error with peer ${conn.peer}:`, err);
      updateStatus(`Connection error with peer ${conn.peer}: ${err.message}`);
      this.scheduleReconnect(conn.peer);
    });
  
    this.updateConnectionStatus();
  }

  private handleKnownPeers(peerIds: string[]): void {
    peerIds.forEach((peerId) => {
      if (peerId !== this.peer.id && !this.knownPeers.has(peerId) && !this.connections.has(peerId)) {
        console.log(`Discovered new peer from connected peer: ${peerId}`);
        this.saveKnownPeer(peerId);
        this.connectToSpecificPeer(peerId);
      }
    });
  }
  
  
  private sendCurrentState(conn: DataConnection): void {
    const currentState = this.sceneState.getCurrentState();
    console.log('Sending current state to peer:', currentState);
    conn.send({ type: 'full_state', data: currentState });
  }

  private updateConnectionStatus(): void {
    const isConnected = this.connections.size > 0;
    console.log(`Connection status updated. Connected: ${isConnected}`);
    if (isConnected && this.mousePositionManager) {
      this.mousePositionManager.startTracking();
    } else if (!isConnected && this.mousePositionManager) {
      this.mousePositionManager.stopTracking();
    }
  }

  
  private scheduleReconnect(peerId: string): void {
    if (!this.reconnectTimers.has(peerId)) {
      const timer = setTimeout(() => {
        this.connectToSpecificPeer(peerId);
      }, this.reconnectInterval);
      this.reconnectTimers.set(peerId, timer);
    }
  }

  

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send({ type: 'heartbeat' });
        }
      });
    }, this.heartbeatInterval) as unknown as number;
  }


  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private saveKnownPeer(peerId: string): void {
    // this.knownPeers.add(peerId);
    // localStorage.setItem(
    //   'knownPeers',
    //   JSON.stringify(Array.from(this.knownPeers))
    // );

    if (peerId !== this.peer.id) {
      this.knownPeers.add(peerId);
      localStorage.setItem('knownPeers', JSON.stringify(Array.from(this.knownPeers)));
    }
  }

  private loadKnownPeers(): void {
    const peers = localStorage.getItem('knownPeers');
    if (peers) {
      try {
        const peerArray = JSON.parse(peers);
        this.knownPeers = new Set(peerArray);
      } catch (e) {
        console.error('Error parsing knownPeers from localStorage', e);
        this.knownPeers = new Set();
      }
    }
  }
  destroyConn(): void {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }
    this.stopHeartbeat();
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();
    this.updateConnectionStatus();
  }

  getSerializableState(): any {
    if (this.sceneState) {
      return this.sceneState.getSerializableState();
    }
    return null; // or a default state if appropriate
  }

  broadcastUpdate(state: any): void {
    console.log("i send you my data! peer", state)
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'update', data: state });
      }
    });
  }

  getSceneState(): SceneState | null {
    return this.sceneState;
  }

  getCurrentPeerId(): string | null {
    if (this.peer) {
      return this.peer.id;
    }
    return null;
  }

  private updateUserIdInput(peerId: string): void {
    const userIdInput = document.getElementById('userIdInput') as HTMLInputElement;
    if (userIdInput) {
      userIdInput.value = peerId;
    }
  }
  

}
let isInitialized = false;

const p2pSync = P2PSync.getInstance();

// DOM elements
const userIdInput = document.getElementById('userIdInput') as HTMLInputElement;
const peerIdInput = document.getElementById('peerIdInput') as HTMLInputElement;
const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

function updateStatus(message: string): void {
  if (statusDiv) {
    statusDiv.textContent = message;
  }
  console.log('Status update:', message);
}

// Auto-populate user ID input if stored peer ID exists
const storedPeerId = localStorage.getItem('myPeerId');
if (storedPeerId && userIdInput) {
  userIdInput.value = storedPeerId;
}

// Initialize P2PSync when user enters their ID or when the page loads with a stored ID
function initializeP2PSync() {
  if (isInitialized) {
    console.log('P2PSync already initialized. Skipping.');
    return;
  }

  const userId = userIdInput?.value.trim();
  if (userId) {
    p2pSync.initialize(userId);
    updateStatus(`Initializing with user ID: ${userId}`);
    isInitialized = true;
  }
}

// Call initializeP2PSync on page load if there's a stored peer ID
if (storedPeerId) {
  initializeP2PSync();
}

userIdInput?.addEventListener('change', initializeP2PSync);

// Connect to peer when button is clicked
connectButton?.addEventListener('click', () => {
  const peerId = peerIdInput?.value.trim();
  if (peerId) {
    p2pSync.connectToSpecificPeer(peerId);
    updateStatus(`Attempting to connect to peer: ${peerId}`);
  } else {
    updateStatus('Please enter a peer ID to connect.');
  }
});

window.addEventListener('beforeunload', () => {
  p2pSync.destroyConn();
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  const sceneState = p2pSync.getSceneState();
  if (!sceneState) return;

  if (document.hidden) {
    // Tab is hidden, store the current state
    const currentState = sceneState.getSerializableState();
    localStorage.setItem('lastKnownState', JSON.stringify(currentState));
  } else {
    // Tab is visible again, check if we need to reconnect
    const lastKnownState = localStorage.getItem('lastKnownState');
    if (lastKnownState) {
      const state = JSON.parse(lastKnownState);
      sceneState.syncWithPeer(state);
    }
  }
});

console.log('P2PSync and UI integration initialized');

export { p2pSync };