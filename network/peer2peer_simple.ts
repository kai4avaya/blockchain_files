import { Peer, DataConnection } from 'peerjs';

interface SceneState {
  getSerializableState: () => any;
  syncWithPeer: (state: any) => void;
  updateObject: (objectState: any) => void;
}

export class P2PSync {
  private static instance: P2PSync | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private sceneState: SceneState | null = null;
  private knownPeers: Set<string> = new Set();
  private heartbeatInterval: number = 5000; // Heartbeat every 5 seconds
  private heartbeatTimer: number | null = null;

  private constructor() {}

  static getInstance(): P2PSync {
    if (!P2PSync.instance) {
      P2PSync.instance = new P2PSync();
    }
    return P2PSync.instance;
  }

  initialize(userId: string, sceneState: SceneState): void {
    this.sceneState = sceneState;
    this.loadKnownPeers();

    // Append a session ID to avoid 'ID is taken' errors
    const sessionId = Date.now();
    const peerId = `${userId}-${sessionId}`;
    this.peer = new Peer(peerId);

    this.peer.on('open', (id) => {
      console.log('My peer ID is:', id);
      updateStatus(`Initialized with peer ID: ${id}`);

      // Attempt to reconnect to known peers
      this.knownPeers.forEach((peerId) => {
        this.connectToSpecificPeer(peerId);
      });

      // Start heartbeat
      this.startHeartbeat();
    });

    this.peer.on('connection', (conn) => {
      // Wait for the connection to open before handling it
      if (conn.open) {
        this.handleConnection(conn);
      } else {
        conn.on('open', () => this.handleConnection(conn));
      }
    });

    this.peer.on('disconnected', () => {
      console.log('Peer disconnected');
      updateStatus('Peer disconnected');
      // Try to reconnect
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

      if (error.type === 'unavailable-id') {
        // Generate a new peer ID and retry
        updateStatus('ID is taken, generating a new ID');
        const newSessionId = Date.now();
        const newPeerId = `${userId}-${newSessionId}`;
        this.peer = new Peer(newPeerId);
      }
    });
  }

  connectToSpecificPeer(peerId: string): void {
    if (!this.peer) {
      console.error('Peer object is undefined. Cannot connect.');
      updateStatus('Error: Peer not initialized');
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
    });

    conn.on('error', (err) => {
      console.error(`Connection error with peer ${peerId}:`, err);
      updateStatus(`Connection error with peer ${peerId}: ${err.message}`);
    });
  }

  private handleConnection(conn: DataConnection): void {
    console.log('Handling connection for peer:', conn.peer);

    // Add connection to the map only after it's open
    this.connections.set(conn.peer, conn);
    updateStatus(`Connected to peer: ${conn.peer}`);

    // Save known peer
    this.saveKnownPeer(conn.peer);

    // Send our current state to the new peer
    if (this.sceneState) {
      const currentState = this.sceneState.getSerializableState();
      conn.send({ type: 'full_state', data: currentState });
    }

    conn.on('data', (data: { type: string; data: any }) => {
      if (!this.sceneState) return;

      if (data.type === 'full_state') {
        console.log('Received full state from peer. Syncing...');
        this.sceneState.syncWithPeer(data.data);
      } else if (data.type === 'update') {
        if (Array.isArray(data.data)) {
          data.data.forEach((objectState) =>
            this.sceneState!.updateObject(objectState)
          );
        } else {
          this.sceneState.updateObject(data.data);
        }
      } else if (data.type === 'heartbeat') {
        // Handle heartbeat messages if needed
      }
    });

    conn.on('close', () => {
      console.log(`Connection closed with peer: ${conn.peer}`);
      this.connections.delete(conn.peer);
      updateStatus(`Disconnected from peer: ${conn.peer}`);
    });

    conn.on('error', (err) => {
      console.error(`Connection error with peer ${conn.peer}:`, err);
      updateStatus(`Connection error with peer ${conn.peer}: ${err.message}`);
    });
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
    this.knownPeers.add(peerId);
    localStorage.setItem(
      'knownPeers',
      JSON.stringify(Array.from(this.knownPeers))
    );
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
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }
    this.stopHeartbeat();
  }

  broadcastUpdate(state: any): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'update', data: state });
      }
    });
  }
}

// UI Integration
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

// Initialize P2PSync when user enters their ID
userIdInput?.addEventListener('change', () => {
  const userId = userIdInput.value.trim();
  if (userId) {
    // Mock SceneState for demonstration
    const mockSceneState: SceneState = {
      getSerializableState: () => ({ /* mock state */ }),
      syncWithPeer: (state) =>
        console.log('Syncing with peer state:', state),
      updateObject: (objectState) =>
        console.log('Updating object:', objectState),
    };
    p2pSync.initialize(userId, mockSceneState);
    updateStatus(`Initializing with user ID: ${userId}`);
  }
});

// Connect to peer when button is clicked
connectButton?.addEventListener('click', () => {
  const peerId = peerIdInput?.value.trim();
  if (peerId) {
    p2pSync.connectToSpecificPeer(peerId);
    updateStatus(`Attempting to connect to peer: ${peerId}`);
    if (peerIdInput) peerIdInput.value = ''; // Clear the input after connecting
  } else {
    updateStatus('Please enter a peer ID to connect.');
  }
});

window.addEventListener('beforeunload', () => {
  p2pSync.destroyConn();
});

window.addEventListener('offline', () => {
  p2pSync.destroyConn();
});

console.log('P2PSync and UI integration initialized');
