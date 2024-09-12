import { Peer, DataConnection } from 'peerjs';
import {generateUniqueId} from "../utils/utils";
const loginName = localStorage.getItem("login_block") || `anonymous_${generateUniqueId(8)}`;
console.log('Login name:', loginName);

export class P2PSync {
  private static instance: P2PSync | null = null;
  private peer: Peer;
  private connections: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel;
  private sceneState: SceneState;

  private constructor() {
    console.log('Initializing P2PSync with login name:', loginName);
    this.peer = new Peer(loginName);
    console.log('Peer instance created with login name:', loginName);
    this.broadcastChannel = new BroadcastChannel('p2pSyncChannel');

    this.peer.on('error', (error) => {
      console.error('PeerJS error:', error);
    });
    this.initializePeer();
  }

  
public connectToSpecificPeer(peerId: string) {
  if (!this.peer) {
    console.error('Peer object is undefined. Cannot connect.');
    return;
  }
  console.log('Attempting to connect to specific peer:', peerId);
  if (this.connections.has(peerId) || peerId === this.peer.id) {
    console.log('Already connected to peer or attempting to connect to self. Peer ID:', peerId);
    return;
  }
  const conn = this.peer.connect(peerId);
  this.handleConnection(conn);
}


public initialize_public(sceneState: SceneState, initialPeers?: string[]): void {
  console.log('Initializing P2PSync instance');
  this.sceneState = sceneState;
  this.peer.on('open', (id) => {
    this.handlePeerOpen(id);
    // Connect to initial peers if provided
    if (initialPeers) {
      initialPeers.forEach(peerId => this.connectToSpecificPeer(peerId));
    }
  });
  this.peer.on('connection', this.handleConnection.bind(this));
  this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
  this.connectToExistingTabs();
  setInterval(this.connectToExistingTabs.bind(this), 5000);
}
  
  private initializePeer() {
    this.peer = new Peer(this.generateUniqueId());
    this.peer.on('error', this.handlePeerError.bind(this));
    this.peer.on('disconnected', this.handleDisconnect.bind(this));
  }


private handlePeerError(error: any) {
  console.error('PeerJS error:', error);
  if (error.type === 'network' || error.type === 'server-error') {
    setTimeout(() => this.initializePeer(), 5000);
  }
}

private handleDisconnect() {
  console.log('Disconnected from PeerJS server. Attempting to reconnect...');
  this.peer.reconnect();
}

private generateUniqueId(): string {
  return `${loginName}_${generateUniqueId(8)}`;
}

  static getInstance(sceneState: SceneState): P2PSync {
    if (!P2PSync.instance) {
      P2PSync.instance = new P2PSync();
      P2PSync.instance.initialize(sceneState);
    }
    return P2PSync.instance;
  }

  private initialize(sceneState: SceneState): void {
    console.log('Initializing P2PSync instance');
    this.sceneState = sceneState;
    this.peer.on('open', this.handlePeerOpen.bind(this));
    this.peer.on('connection', this.handleConnection.bind(this));
    this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
    this.connectToExistingTabs();
    // Periodically check for new peers
    setInterval(this.connectToExistingTabs.bind(this), 5000);
  }

  private handlePeerOpen(id: string) {
    console.log('PeerJS open event received. My peer ID is:', id);
    if (id === null || id === undefined) {
      console.error('Received null or undefined peer ID');
      return;
    }
    if (id !== loginName) {
      console.warn('Received peer ID does not match login name. Received:', id, 'Expected:', loginName);
    }
    this.broadcastChannel.postMessage({ type: 'new_peer', peerId: id });
  }

 
  private handleConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('Connected to peer:', conn.peer);
      this.connections.set(conn.peer, conn);
      
      // Send our current state to the new peer
      const currentState = this.sceneState.getSerializableState();
      conn.send({ type: 'full_state', data: currentState });
    });

    conn.on('data', (data: { type: string, data: any }) => {
      if (data.type === 'full_state') {
        console.log('Received full state from peer. Syncing...');
        this.sceneState.syncWithPeer(data.data);
        
        // After syncing, send our updated state back to ensure both peers are in sync
        const updatedState = this.sceneState.getSerializableState();
        conn.send({ type: 'full_state', data: updatedState });
      } else if (data.type === 'update') {
        // Handle individual object updates
        if (Array.isArray(data.data)) {
          data.data.forEach(objectState => this.sceneState.updateObject(objectState));
        } else {
          this.sceneState.updateObject(data.data);
        }
      }
    });
  }

  private handleBroadcastMessage(event: MessageEvent) {
    const { type, peerId } = event.data;
    console.log('Received broadcast message. Type:', type, 'Peer ID:', peerId);
    if (type === 'new_peer' && peerId && peerId !== this.peer?.id) {
      console.log("NEW PEER being broadcast", type, peerId);
      this.connectToPeer(peerId);
    } else if (type === 'request_peers') {
      console.log("Peer request received");
      if (this.peer && this.peer.id) {
        this.broadcastChannel.postMessage({ type: 'new_peer', peerId: this.peer.id });
      } else {
        console.warn('Cannot respond to peer request: peer or peer ID is undefined');
      }
    }
  }
  
  private connectToExistingTabs() {
    console.log('Attempting to connect to existing tabs');
    this.broadcastChannel.postMessage({ type: 'request_peers' });
  }

  connectToPeer(peerId: string) {
    if (!this.peer) {
      console.error('Peer object is undefined. Cannot connect.');
      return;
    }
    console.log('Attempting to connect to peer:', peerId);
    if (this.connections.has(peerId) || peerId === this.peer.id) {
      console.log('Already connected to peer or attempting to connect to self. Peer ID:', peerId);
      return;
    }
    const conn = this.peer.connect(peerId);
    this.handleConnection(conn);
  }

  broadcastUpdate(state: ObjectState | ObjectState[]) {
    if (!this.peer) {
      console.error('Peer object is undefined. Cannot broadcast update.');
      return;
    }
    console.log('Broadcasting update to all connected peers. Connection count:', this.connections.size);
    this.connections.forEach(conn => conn.send({ type: 'update', data: state }));
  }

  getMyPeerId(): string {
    const peerId = this.peer.id;
    console.log('Getting my peer ID:', peerId);
    return peerId;
  }
  subscribeToChanges(callback: (state: ObjectState) => void) {
    // This is a simple implementation. You might want to use a more robust event system.
    this.sceneState.onStateChange = callback;
  }

  // Call this method after initializing P2PSync
  initializeContinuousSync() {
    this.subscribeToChanges((updatedState) => {
      this.broadcastUpdate(updatedState);
    });
  }
}

console.log("HELLO TURD CAT")
// UI Integration
const p2pSync = P2PSync.getInstance();

// DOM elements
const userIdInput = document.getElementById('userIdInput') as HTMLInputElement;
const peerIdInput = document.getElementById('peerIdInput') as HTMLInputElement;
const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

function updateStatus(message: string) {
  statusDiv.textContent = message;
  console.log('Status update:', message);
}

// Initialize P2PSync when user enters their ID
userIdInput.addEventListener('change', () => {
  const userId = userIdInput.value.trim();
  if (userId) {
    p2pSync.initialize(userId, sceneState); // Assume sceneState is defined elsewhere
    updateStatus(`Initializing with user ID: ${userId}`);
  }
});

// Connect to peer when button is clicked
connectButton.addEventListener('click', () => {
  const peerId = peerIdInput.value.trim();
  if (peerId) {
    p2pSync.connectToSpecificPeer(peerId);
    updateStatus(`Attempting to connect to peer: ${peerId}`);
    peerIdInput.value = ''; // Clear the input after connecting
  } else {
    updateStatus('Please enter a peer ID to connect.');
  }
});