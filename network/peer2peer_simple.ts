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

  private constructor() {}

  static getInstance(): P2PSync {
    if (!P2PSync.instance) {
      P2PSync.instance = new P2PSync();
    }
    return P2PSync.instance;
  }

  initialize(userId: string, sceneState: SceneState): void {
    this.sceneState = sceneState;
    this.peer = new Peer(userId);

    this.peer.on('open', (id) => {
      console.log('My peer ID is:', id);
      updateStatus(`Initialized with peer ID: ${id}`);
    });

    this.peer.on('connection', this.handleConnection.bind(this));
    this.peer.on('error', (error) => {
      console.error('PeerJS error:', error);
      updateStatus(`PeerJS error: ${error.type}`);
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
      updateStatus(`Connection error: ${err.message}`);
    });
  }

  private handleConnection(conn: DataConnection): void {
    if (!conn) {
      console.error('Received undefined connection in handleConnection');
      return;
    }

    console.log('Handling connection for peer:', conn.peer);
    this.connections.set(conn.peer, conn);
    updateStatus(`Connected to peer: ${conn.peer}`);
    
    // Send our current state to the new peer
    if (this.sceneState) {
      const currentState = this.sceneState.getSerializableState();
      conn.send({ type: 'full_state', data: currentState });
    }

    conn.on('data', (data: { type: string, data: any }) => {
      if (!this.sceneState) return;

      if (data.type === 'full_state') {
        console.log('Received full state from peer. Syncing...');
        this.sceneState.syncWithPeer(data.data);
      } else if (data.type === 'update') {
        if (Array.isArray(data.data)) {
          data.data.forEach(objectState => this.sceneState!.updateObject(objectState));
        } else {
          this.sceneState.updateObject(data.data);
        }
      }
    });

    conn.on('close', () => {
      console.log(`Connection closed with peer: ${conn.peer}`);
      this.connections.delete(conn.peer);
      updateStatus(`Disconnected from peer: ${conn.peer}`);
    });
  }

  broadcastUpdate(state: any): void {
    this.connections.forEach(conn => conn.send({ type: 'update', data: state }));
  }
}

// UI Integration
const p2pSync = P2PSync.getInstance();

// DOM elements
// const userIdInput = document.getElementById('userIdInput') as HTMLInputElement;
// const peerIdInput = document.getElementById('peerIdInput') as HTMLInputElement;
// const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
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
      syncWithPeer: (state) => console.log('Syncing with peer state:', state),
      updateObject: (objectState) => console.log('Updating object:', objectState)
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

console.log("P2PSync and UI integration initialized");