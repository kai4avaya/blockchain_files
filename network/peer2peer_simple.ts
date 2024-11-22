// network\peer2peer_simple.ts

import { Peer, DataConnection } from "peerjs";
import MousePositionManager from "../memory/collaboration/mouse_colab";
import { TabManager } from "../ui/components/codemirror_md copy/codemirror-rich-markdoc/editor/extensions/tabManager";
import leaderCoordinator from './elections';
import dbSyncManager from './sync_db';
import indexDBOverlay from '../memory/local/file_worker';

interface SceneState {
  getSerializableState: () => any;
  syncWithPeer: (state: any) => void;
  updateObject: (objectState: any) => void;
}

interface MouseOverlayCanvas {
  updateMousePosition: (peerId: string, x: number, y: number) => void;
  removePeerCursor: (peerId: string) => void;
}

interface CustomMessageHandler {
  (message: any, peerId: string): void;
}

interface PeerConnectHandler {
  (peerId: string): void;
}

interface CustomMessage {
  type: string;
  data: any;
}

// Add new interface for peer status
interface PeerStatus {
  connected: boolean;
  connecting: boolean;
}

class P2PSync {
  private static instance: P2PSync | null = null;
  private tabManager: TabManager | null = null;

  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private sceneState: SceneState | null = null;
  private knownPeers: Set<string> = new Set();
  private heartbeatInterval: number = 5000; // Heartbeat every 5 seconds
  private heartbeatTimer: number | null = null;
  private reconnectInterval: number = 10000;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private mousePositionManager: MousePositionManager | null = null;
  private mouseOverlay: MouseOverlayCanvas | null = null;

  private customMessageHandlers: Array<(message: any, peerId: string) => void> = [];

  private peerConnectHandlers: Set<PeerConnectHandler> = new Set();

  private peerStatuses: Map<string, PeerStatus> = new Map();

  private constructor() {
    // Remove any existing event listener first
    const peerIdInput = document.getElementById("peerIdInput") as HTMLInputElement;
    if (peerIdInput) {
      const newPeerIdInput = peerIdInput.cloneNode(true) as HTMLInputElement;
      peerIdInput.parentNode?.replaceChild(newPeerIdInput, peerIdInput);
    }
  }

  static getInstance(): P2PSync {
    if (!P2PSync.instance) {
      P2PSync.instance = new P2PSync();
    }
    return P2PSync.instance;
  }

  initialize(userId: string): void {
    // this.sceneState = sceneState;
    this.loadKnownPeers();

    const peerId = localStorage.getItem("myPeerId") || userId;
    this.peer = new Peer(peerId);

    // Add localStorage listener for userIdInput
    const userIdInput = document.getElementById("userIdInput") as HTMLInputElement;
    if (userIdInput) {
      userIdInput.value = peerId;
      userIdInput.addEventListener('input', (e) => {
        const newUserId = (e.target as HTMLInputElement).value;
        localStorage.setItem("myPeerId", newUserId);
        localStorage.setItem("login_block", newUserId);
      });
    }

    this.peer.on("open", (id) => {
      localStorage.setItem("myPeerId", id);
      updateStatus(`Initialized with peer ID: ${id}`);
      this.updateUserIdInput(id);
      
      // Load and display all peers when peer is initialized
      this.loadAndDisplayAllPeers();
      
      this.startHeartbeat();
      dbSyncManager.startSync();
    });

    this.peer.on("connection", (conn) => {
      if (conn.open) {
        this.handleConnection(conn);
      } else {
        conn.on("open", () => this.handleConnection(conn));
      }
    });

    this.peer.on("disconnected", () => {
      updateStatus("Peer disconnected. Attempting to reconnect...");
      if (this.peer && !this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on("close", () => {
      updateStatus("Peer connection closed");
      this.stopHeartbeat();
    });

    this.peer.on("error", (error) => {
      // Only log connection errors if they're not related to peer unavailability
      if (!error.type.includes("Could not connect to peer")) {
        console.error("PeerJS error:", error);
        updateStatus(`PeerJS error: ${error.type}`);
      } else {
        // Optionally log to debug level if needed
        console.debug("Peer unavailable:", error.type);
      }
    });

    // Add the peer database change handler to custom message handlers
    this.customMessageHandlers.push((message: any, peerId: string) => {
        if (message.type === 'db_sync' && message.data.tableName === 'peers') {
            this.handlePeerDatabaseChange(message.data.tableName, message.data.data);
        }
    });
  }
  setMouseOverlay(overlay: MouseOverlayCanvas): void {
    this.mouseOverlay = overlay;
  }

  private safeConnectToSpecificPeer(peerId: string): void {
    if (!this.peer || this.peer.destroyed) return;
    if (this.connections.has(peerId) || peerId === this.peer.id) return;

    try {
        const conn = this.peer.connect(peerId, { 
            reliable: true,
            metadata: { timeout: 5000 } 
        });

        conn.on("open", () => {
            this.connections.set(peerId, conn);
            this.updatePeerPillStatus(peerId, true);
            this.handleConnection(conn);
            this.clearReconnectTimer(peerId);
        });

        // Silently handle connection errors
        conn.on("error", () => {
            this.connections.delete(peerId);
            // Optionally log to debug level
            console.debug('Connection attempt failed for peer:', peerId);
        });

    } catch (error) {
        // Silently handle any connection errors
        console.debug('Connection attempt failed:', error);
    }
  }

  public setTabManager(tabManager: TabManager): void {
    this.tabManager = tabManager;
  }
  setMousePositionManager(manager: MousePositionManager): void {
    this.mousePositionManager = manager;
  }

  updateMousePosition(x: number, y: number): void {
    if (this.connections.size === 0 || !this.mouseOverlay || !this.peer) return;

    this.broadcastMousePosition(x, y);
  }

  private broadcastMousePosition(x: number, y: number): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: "mouse_position", data: { x, y } });
      }
    });
  }

  setSceneState(sceneState: SceneState): void {
    this.sceneState = sceneState;
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
    console.log('Connection established with:', conn.peer); // Debug log
    
    // Ensure connection is in the map
    this.connections.set(conn.peer, conn);
    
    // Force status update
    this.updatePeerPillStatus(conn.peer, true);
    
    conn.on("open", () => {
        console.log('Connection opened with:', conn.peer); // Debug log
        this.updatePeerPillStatus(conn.peer, true);
    });

    conn.on("close", () => {
        console.log('Connection closed with:', conn.peer); // Debug log
        this.connections.delete(conn.peer);
        this.updatePeerPillStatus(conn.peer, false);
    });

    // Call leader coordinator to handle the connection and election
    leaderCoordinator.connectToPeer(conn.peer);
  
    const checkConnection = setInterval(() => {
      if (!conn.open) {
        clearInterval(checkConnection);
        this.connections.delete(conn.peer);
        this.scheduleReconnect(conn.peer);
      }
    }, 5000);
  
    this.peerConnectHandlers.forEach((handler) => handler(conn.peer));
  
    // Update pill status when connection is established
    this.updatePeerPillStatus(conn.peer, true);
  
    // Send current state immediately after connection
    this.sendCurrentState(conn);
    conn.send({ type: "known_peers", data: Array.from(this.knownPeers) });
  
    leaderCoordinator.triggerInitialDbSync(conn);
  

    // Add immediate sync initiation
    dbSyncManager.initiateSync(conn.peer);

    conn.on("data", (rawData: unknown) => {
      const data = rawData as { type: string; docId?: string; data?: any, timestamp?: any };
      this.customMessageHandlers.forEach((handler) => handler(data, conn.peer));
      switch (data.type) {
        case "request_current_state":
          this.sendCurrentState(conn);
          const docId = data?.docId;
          if (docId) {
            const docState = this.tabManager?.getDocState(docId);
            if (docState) {
              conn.send({
                type: "full_state",
                docId: docId,
                data: docState,
              });
            }
          }
          break;
        case "full_state":
          this.sceneState?.syncWithPeer(data.data);
          if (data.docId && data.data) {
            this.tabManager?.handleFullState([
              {
                docId: data.docId,
                state: data.data,
              },
            ]);
          }
          break;
          case "request_all_states":
            if (this.tabManager) {
              const allDocsState = this.tabManager.getAllDocsState();
              conn.send({
                type: 'full_state_all',
                data: allDocsState,
              });
            }
            break;

          case "full_state_all":
            if (this.tabManager) {
              this.tabManager.handleFullState(data.data);
            }
            break;
          case "db_sync": {
              // Forward to DBSyncManager for version check and processing
              this.customMessageHandlers.forEach(handler => handler(data, conn.peer));
              break;
          }

          case "connected_peers":
            case "db_sync_initial":
            case "leader_announcement":
            case "request_leader_election":
              // Delegate leader-specific messages to P2PLeaderCoordinator
              leaderCoordinator.handleIncomingData(data);
              break;

        case "update":
          this.sceneState?.syncWithPeer(data.data);
          break;
        case "mouse_position":
          if (this.mouseOverlay) {
            this.mouseOverlay.updateMousePosition(
              conn.peer,
              data.data.x,
              data.data.y
            );
          }
          break;
        case "known_peers":
          this.handleKnownPeers(data.data);
          break;
        case "yjs_sync":
        case "yjs_sync_request":
        case "yjs_awareness":
          this.customMessageHandlers.forEach((handler) =>
            handler(data, conn.peer)
          );
          break;
        case "yjs_update":
          this.customMessageHandlers.forEach((handler) =>
            handler(data, conn.peer)
          );
          break;

        case "create_tab":
        case "close_tab":
        case "rename_tab":
          this.customMessageHandlers.forEach((handler) =>
            handler(data, conn.peer)
          );
          break;
          case "db_sync_check":
            console.log("Handling db sync check", data, "data.data", data.data);
            if (typeof data.data === 'object' && data.data !== null) {
                // Pass the object directly since it's already in the correct format
                dbSyncManager.handleSyncCheck(
                    data.data as Record<string, number>,  // Already a plain object
                    conn.peer,
                    data.timestamp
                );
            } else {
                console.error("Invalid db_sync_check data format:", data.data);
            }
            break;
          
        case "db_sync_request":
          dbSyncManager.handleSyncRequest(data.data);
          break;
          
        case "db_sync_response":
          dbSyncManager.handleSyncResponse(data.data, data.timestamp);
          break;
          
        default:
          console.warn(
            `Received unknown data type: ${data.type} from peer: ${conn.peer}`
          );
      }
    });


    conn.on("close", () => {
      clearInterval(checkConnection);
      this.connections.delete(conn.peer);
      updateStatus(`Disconnected from peer: ${conn.peer}`);
      
      // Only attempt reconnect if peer is still known
      if (this.knownPeers.has(conn.peer)) {
        this.scheduleReconnect(conn.peer);
      }
      
      this.updateConnectionStatus();
      if (this.mouseOverlay) {
        this.mouseOverlay.removePeerCursor(conn.peer);
      }
      this.updatePeerPillStatus(conn.peer, false);
    });

    conn.on("error", (err) => {
      console.error(`Connection error with peer ${conn.peer}:`, err);
      updateStatus(`Connection error with peer ${conn.peer}: ${err.message}`);
      this.scheduleReconnect(conn.peer);
    });

    this.updateConnectionStatus();

    // Add the connecting peer to our database when they connect to us
    const remotePeerId = conn.peer;
    this.addPeerToDatabase(remotePeerId).then(() => {
        this.addKnownPeer(remotePeerId);
        this.createPeerPill(remotePeerId);
    });
  }

  private cleanupStalePeers(): void {
    this.knownPeers.forEach(peerId => {
      const conn = this.connections.get(peerId);
      if (!conn || !conn.open) {
        const reconnectTimer = this.reconnectTimers.get(peerId);
        if (!reconnectTimer) {
          this.removeKnownPeer(peerId);
        }
      }
    });
  }

  private handleKnownPeers(peerIds: string[]): void {
    peerIds.forEach((peerId) => {
      if (
        peerId !== this.peer?.id &&
        !this.knownPeers.has(peerId) &&
        !this.connections.has(peerId)
      ) {
        this.saveKnownPeer(peerId);
        this.connectToSpecificPeer(peerId);
      }
    });
  }

  private sendCurrentState(conn: DataConnection): void {
    if (!this.tabManager) {
      console.warn("TabManager is not set in P2PSync. Cannot send document states.");
      return;
    }
    
    const docsState = this.tabManager.getAllDocsState();
    conn.send({ type: "full_state_all", data: docsState });
  }

  private updateConnectionStatus(): void {
    const isConnected = this.connections.size > 0;
    if (isConnected && this.mousePositionManager) {
      this.mousePositionManager.startTracking();
    } else if (!isConnected && this.mousePositionManager) {
      this.mousePositionManager.stopTracking();
    }
  }

  private scheduleReconnect(peerId: string): void {
    // Clear any existing reconnect timer
    this.clearReconnectTimer(peerId);

    // Only schedule reconnect if the peer is in knownPeers
    if (this.knownPeers.has(peerId)) {
      const timer = setTimeout(() => {
        // Verify peer is still known before attempting reconnect
        if (this.knownPeers.has(peerId)) {
          this.safeConnectToSpecificPeer(peerId);
        }
      }, this.reconnectInterval);
      
      this.reconnectTimers.set(peerId, timer);
    }
  }

   // Add a method to safely remove a known peer
   private removeKnownPeer(peerId: string): void {
    this.knownPeers.delete(peerId);
    this.clearReconnectTimer(peerId);
    localStorage.setItem("knownPeers", JSON.stringify(Array.from(this.knownPeers)));
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = window.setInterval(async () => {
        try {
            // Get all non-deleted peers from the database
            const peers = await indexDBOverlay.getData('peers');
            peers.forEach((peer: any) => {
                if (!peer.isDeleted && !this.connections.has(peer.peerId)) {
                    // Quietly attempt to connect to disconnected peers
                    this.safeConnectToSpecificPeer(peer.peerId);
                }
            });
        } catch (error) {
            // Silently handle any connection errors
            console.debug('Heartbeat connection attempt failed:', error);
        }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private saveKnownPeer(peerId: string): void {
    if (peerId !== this.peer?.id) {
      this.knownPeers.add(peerId);
      localStorage.setItem(
        "knownPeers",
        JSON.stringify(Array.from(this.knownPeers))
      );
    }
  }

  private loadKnownPeers(): void {
    const peers = localStorage.getItem("knownPeers");
    if (peers) {
      try {
        const peerArray = JSON.parse(peers);
        this.knownPeers = new Set(peerArray);
      } catch (e) {
        console.error("Error parsing knownPeers from localStorage", e);
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
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: "update", data: state });
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
    const userIdInput = document.getElementById(
      "userIdInput"
    ) as HTMLInputElement;
    if (userIdInput) {
      userIdInput.value = peerId;
    }
  }

  public setCustomMessageHandler(handler: (message: any, peerId: string) => void): void {
    this.customMessageHandlers.push(handler);
  }

  onPeerConnect(handler: PeerConnectHandler): void {
    this.peerConnectHandlers.add(handler);
  }

  sendCustomMessage(peerId: string, message: any): void {
    const conn = this.connections.get(peerId);
    if (conn?.open) {
      conn.send(message);
    }
  }

  broadcastCustomMessage(message: any): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  private handlePeerInputChange(input: string): void {
    // No longer needed - connection only happens on button click
    return;
  }

  private async addPeerToDatabase(peerId: string): Promise<void> {
    try {
        const peerData = {
            peerId,
            status: 'connecting',
            lastAttempt: Date.now(),
            version: 1,
            id: peerId
        };
        
        await indexDBOverlay.saveData('peers', peerData);
    } catch (error) {
        console.error('Error saving peer to database:', error);
    }
  }

  // Update existing method
  public async connectToSpecificPeer(peerId: string): Promise<void> {
    if (!this.peer || this.peer.destroyed) {
        console.warn("Peer object is undefined or destroyed. Cannot connect.");
        updateStatus("Error: Peer not initialized or destroyed");
        return;
    }

    if (this.connections.has(peerId) || peerId === this.peer.id) {
        return;
    }

    await this.addPeerToDatabase(peerId);
    this.addKnownPeer(peerId);
    this.createPeerPill(peerId);
    this.safeConnectToSpecificPeer(peerId);
  }

  private createPeerPill(peerId: string): void {
    const pillContainer = document.getElementById('peer-pills-container');
    if (!pillContainer || pillContainer.querySelector(`[data-peer-id="${peerId}"]`)) return;

    const pill = document.createElement('div');
    pill.className = 'peer-pill';
    pill.setAttribute('data-peer-id', peerId);
    
    // Check if peer is already connected
    const isConnected = this.connections.has(peerId);
    
    pill.innerHTML = `
        <span class="peer-id">${peerId}</span>
        <span class="connection-status">
            <span class="connecting" style="display: ${isConnected ? 'none' : 'inline-block'};">
                <svg class="peer-pill-spinner h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </span>
            <span class="connected" style="display: ${isConnected ? 'inline-block' : 'none'};">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </span>
        </span>
        <button class="disconnect-btn" title="Disconnect">×</button>
    `;

    // Add disconnect button handler
    const disconnectBtn = pill.querySelector('.disconnect-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.disconnectPeer(peerId);
        });
    }

    pillContainer.appendChild(pill);
    
    // Ensure correct initial status is shown
    if (isConnected) {
        this.updatePeerPillStatus(peerId, true);
    }
  }

  // Add method to update peer pill status
  private updatePeerPillStatus(peerId: string, isConnected: boolean): void {
    console.log('Updating status for peer:', peerId, 'Connected:', isConnected); // Debug log
    
    const pill = document.querySelector(`[data-peer-id="${peerId}"]`);
    if (!pill) {
        console.log('Pill not found for peer:', peerId); // Debug log
        return;
    }

    const connecting = pill.querySelector('.connecting') as HTMLElement;
    const connected = pill.querySelector('.connected') as HTMLElement;

    if (connecting && connected) {
        if (isConnected) {
            connecting.style.display = 'none';
            connected.style.display = 'inline-block';
        } else {
            connecting.style.display = 'inline-block';
            connected.style.display = 'none';
        }
        console.log('Status updated for peer:', peerId); // Debug log
    } else {
        console.log('Status elements not found for peer:', peerId); // Debug log
    }
  }

  private async disconnectPeer(peerId: string): Promise<void> {
    try {
        // Mark the peer as deleted in the database
        await indexDBOverlay.deleteItem_field('peers', peerId);
        
        // Close the connection if it exists
        const conn = this.connections.get(peerId);
        if (conn) {
            conn.close();
            this.connections.delete(peerId);
        }

        // Remove from known peers
        this.knownPeers.delete(peerId);
        localStorage.setItem("knownPeers", JSON.stringify(Array.from(this.knownPeers)));

        // Remove the pill from UI
        const pillContainer = document.getElementById('peer-pills-container');
        const pill = pillContainer?.querySelector(`[data-peer-id="${peerId}"]`);
        if (pill) {
            pill.remove();
        }

        // Clear any reconnection timers
        this.clearReconnectTimer(peerId);
    } catch (error) {
        console.error('Error disconnecting peer:', error);
    }
  }

  // Add this property to track connect button clicks
  private isConnectButtonPress: boolean = false;

  // Add this method to handle connect button clicks
  public async handleConnectButtonClick(): Promise<void> {
    this.isConnectButtonPress = true;
    const peerIdInput = document.getElementById('peerIdInput') as HTMLInputElement;
    if (peerIdInput) {
        const peerIds = peerIdInput.value
            .split(',')
            .map(id => id.trim())
            .filter(id => id && id !== this.peer?.id && !this.knownPeers.has(id));

        // Process each peer ID
        peerIds.forEach(peerId => {
            this.addPeerToDatabase(peerId);
            this.addKnownPeer(peerId);
            this.createPeerPill(peerId);
            this.safeConnectToSpecificPeer(peerId);
        });

        // Clear input after processing all peers
        peerIdInput.value = '';
    }
    this.isConnectButtonPress = false;
  }

  private addKnownPeer(peerId: string): void {
    if (!this.knownPeers.has(peerId) && peerId !== this.peer?.id) {
        this.knownPeers.add(peerId);
        // Save to localStorage
        localStorage.setItem("knownPeers", JSON.stringify(Array.from(this.knownPeers)));
    }
  }

  // Add this method to load peers from IndexedDB
  private async loadAndDisplayAllPeers(): Promise<void> {
    try {
        // Get all peers from the database
        const peers = await indexDBOverlay.getData('peers');
        
        // Clear existing pills first
        const pillContainer = document.getElementById('peer-pills-container');
        if (pillContainer) {
            pillContainer.innerHTML = '';
        }

        // Create pills for non-deleted peers only, excluding self
        peers.forEach((peer: any) => {
            if (!peer.isDeleted && peer.peerId !== this.peer?.id) {
                this.knownPeers.add(peer.peerId);
                this.createPeerPill(peer.peerId);
                
                // If the peer is not connected, try to connect
                if (!this.connections.has(peer.peerId)) {
                    this.safeConnectToSpecificPeer(peer.peerId);
                }
            }
        });

        // Update localStorage
        localStorage.setItem("knownPeers", JSON.stringify(Array.from(this.knownPeers)));
    } catch (error) {
        console.error('Error loading peers from database:', error);
    }
  }

  // Add method to initialize the peer2peer modal
  public initializePeerModal(): void {
    this.loadAndDisplayAllPeers();
    
    // Restore any active connections
    this.knownPeers.forEach(peerId => {
        if (!this.connections.has(peerId)) {
            this.safeConnectToSpecificPeer(peerId);
        }
    });
  }

  // Add this method to handle database changes
  private handlePeerDatabaseChange(tableName: string, data: any): void {
    if (tableName === 'peers' && document.getElementById('peer-pills-container')) {
        // Modal is open (container exists), refresh the peer list
        this.loadAndDisplayAllPeers();
    }
  }
}
let isInitialized = false;

const p2pSync = P2PSync.getInstance();

// DOM elements
const userIdInput = document.getElementById("userIdInput") as HTMLInputElement;
const peerIdInput = document.getElementById("peerIdInput") as HTMLInputElement;
const connectButton = document.getElementById(
  "connectButton"
) as HTMLButtonElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;



function updateStatus(message: string): void {
  const statusDiv = document.getElementById('status');
  
  if (statusDiv) {
    // Clear existing content
    statusDiv.innerHTML = '';

    // Set the new status message
    statusDiv.textContent = message;

    // Check if the message contains ": " and extract text after it
    const match = message.match(/: (.+)/);

    if (match && match[1]) {
      const stringToCopy = match[1];

      // Create a copy icon (no button wrapper)
      const copyIcon = document.createElement('span');
      copyIcon.style.cursor = 'pointer'; // Set cursor to indicate it's clickable
      copyIcon.style.marginLeft = '10px'; // Optional spacing
      copyIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1em; height: 1em; vertical-align: middle;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
        </svg>
      `;

      // Add click event to copy stringToCopy to clipboard
      copyIcon.addEventListener('click', () => {
        navigator.clipboard.writeText(stringToCopy).then(() => {
          // Change icon to a checkmark on success
          copyIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1em; height: 1em; vertical-align: middle; color: green;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          `;

          // Reset icon after a short delay
          setTimeout(() => {
            copyIcon.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 1em; height: 1em; vertical-align: middle;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
              </svg>
            `;
          }, 1000); // Adjust time as needed
        });
      });

      // Append the copy icon to the status div
      statusDiv.appendChild(copyIcon);
    }
  }
}

// Auto-populate user ID input if stored peer ID exists
const storedPeerId = localStorage.getItem("myPeerId");
if (storedPeerId && userIdInput) {
  userIdInput.value = storedPeerId;
}

// Initialize P2PSync when user enters their ID or when the page loads with a stored ID
function initializeP2PSync() {
  if (isInitialized) {
    return;
  }

  const userId = userIdInput?.value.trim();
  if (userId) {
    p2pSync.initialize(userId);
    updateStatus(`Initializing with user ID: ${userId}`);
    isInitialized = true;
  }
}

if (storedPeerId) {
  initializeP2PSync();
}

userIdInput?.addEventListener("change", initializeP2PSync);

// Connect to peer when button is clicked
connectButton?.addEventListener("click", () => {
  p2pSync.handleConnectButtonClick();
  const peerId = peerIdInput?.value.trim();
  if (peerId) {
    p2pSync.connectToSpecificPeer(peerId);
    updateStatus(`Attempting to connect to peer: ${peerId}`);
  } else {
    updateStatus("Please enter a peer ID to connect.");
  }
});

window.addEventListener("beforeunload", () => {
  p2pSync.destroyConn();
});

// Handle visibility change
document.addEventListener("visibilitychange", () => {
  const sceneState = p2pSync.getSceneState();
  if (!sceneState) return;

  if (document.hidden) {
    // Tab is hidden, store the current state
    const currentState = sceneState.getSerializableState();
    localStorage.setItem("lastKnownState", JSON.stringify(currentState));
  } else {
    // Tab is visible again, check if we need to reconnect
    const lastKnownState = localStorage.getItem("lastKnownState");
    if (lastKnownState) {
      const state = JSON.parse(lastKnownState);
      sceneState.syncWithPeer(state);
    }
  }
});

export { p2pSync };
