// network\peer2peer_simple.ts

import { Peer, DataConnection } from "peerjs";
import MousePositionManager from "../memory/collaboration/mouse_colab";
import { TabManager } from "../ui/components/codemirror_md copy/codemirror-rich-markdoc/editor/extensions/tabManager";

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
  // private mousePositions: Map<string, MousePosition> = new Map();
  private mousePositionManager: MousePositionManager | null = null;
  private mouseOverlay: MouseOverlayCanvas | null = null;

  // private customMessageHandlers: Set<CustomMessageHandler> = new Set();
  private customMessageHandlers: Array<(message: any, peerId: string) => void> = [];

  private peerConnectHandlers: Set<PeerConnectHandler> = new Set();

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

    const storedPeerId = localStorage.getItem("myPeerId");
    // const peerId = storedPeerId || `${userId}-${Date.now()}`;
    // this.peer = new Peer(peerId);

    // this.peer.on("open", (id) => {
    //   localStorage.setItem("myPeerId", id);
    //   updateStatus(`Initialized with peer ID: ${id}`);
    //   this.updateUserIdInput(id); // Update the user ID input instead

    //   this.knownPeers.forEach((peerId) => this.connectToSpecificPeer(peerId));
    //   this.startHeartbeat();
    // });

    const peerId = storedPeerId || `${userId}-${Date.now()}`;
    this.peer = new Peer(peerId);

    this.peer.on("open", (id) => {
      localStorage.setItem("myPeerId", id);
      updateStatus(`Initialized with peer ID: ${id}`);
      this.updateUserIdInput(id);

      // Wrap the connection attempts in a safe connect method
      this.knownPeers.forEach((peerId) => this.safeConnectToSpecificPeer(peerId));
      this.startHeartbeat();
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
      console.error("PeerJS error:", error);
      updateStatus(`PeerJS error: ${error.type}`);
    });
  }
  setMouseOverlay(overlay: MouseOverlayCanvas): void {
    this.mouseOverlay = overlay;
  }

  private safeConnectToSpecificPeer(peerId: string): void {
    if (!this.peer || this.peer.destroyed) {
      console.warn("Peer object is undefined or destroyed. Cannot connect.");
      updateStatus("Error: Peer not initialized or destroyed");
      return;
    }

    if (this.connections.has(peerId) || peerId === this.peer.id) {
      return;
    }

    try {
      const conn = this.peer.connect(peerId, { 
        reliable: true,
        // Add a shorter connection timeout
        metadata: { timeout: 5000 } 
      });

      // Set a connection timeout
      const timeout = setTimeout(() => {
        if (!conn.open) {
          conn.close();
          this.connections.delete(peerId);
          console.warn(`Connection timeout for peer ${peerId}`);
        }
      }, 5000);

      conn.on("open", () => {
        clearTimeout(timeout);
        this.handleConnection(conn);
        this.clearReconnectTimer(peerId);
      });

      conn.on("error", (err) => {
        clearTimeout(timeout);
        console.warn(`Connection error with peer ${peerId}:`, err);
        this.connections.delete(peerId);
        this.scheduleReconnect(peerId);
      });
    } catch (error) {
      console.warn(`Failed to initiate connection to peer ${peerId}:`, error);
      this.scheduleReconnect(peerId);
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

  // connectToSpecificPeer(peerId: string): void {
  //   if (!this.peer || this.peer.destroyed) {
  //     console.error("Peer object is undefined or destroyed. Cannot connect.");
  //     updateStatus("Error: Peer not initialized or destroyed");
  //     return;
  //   }
  //   if (this.connections.has(peerId) || peerId === this.peer.id) {
  //     updateStatus("Already connected or trying to connect to self");
  //     return;
  //   }
  //   updateStatus(`Attempting to connect to peer: ${peerId}`);

  //   const conn = this.peer.connect(peerId, { reliable: true });

  //   conn.on("open", () => {
  //     this.handleConnection(conn);
  //     this.clearReconnectTimer(peerId);
  //   });

  //   conn.on("error", (err) => {
  //     console.error(`Connection error with peer ${peerId}:`, err);
  //     updateStatus(`Connection error with peer ${peerId}: ${err.message}`);
  //     this.scheduleReconnect(peerId);
  //   });
  // }

  connectToSpecificPeer(peerId: string): void {
    this.safeConnectToSpecificPeer(peerId);
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
    this.connections.set(conn.peer, conn);
    updateStatus(`Connected to peer: ${conn.peer}`);
    this.saveKnownPeer(conn.peer);
    const checkConnection = setInterval(() => {
      if (!conn.open) {
        clearInterval(checkConnection);
        this.connections.delete(conn.peer);
        this.scheduleReconnect(conn.peer);
      }
    }, 5000);

    this.peerConnectHandlers.forEach((handler) => handler(conn.peer));

    // Send current state immediately after connection
    this.sendCurrentState(conn);
    conn.send({ type: "known_peers", data: Array.from(this.knownPeers) });

    conn.on("data", (rawData: unknown) => {
      const data = rawData as { type: string; docId?: string; data?: any };
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
    });

    conn.on("error", (err) => {
      console.error(`Connection error with peer ${conn.peer}:`, err);
      updateStatus(`Connection error with peer ${conn.peer}: ${err.message}`);
      this.scheduleReconnect(conn.peer);
    });

    this.updateConnectionStatus();
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
    this.heartbeatTimer = setInterval(() => {
      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send({ type: "heartbeat" });
        }
      });
      
      // Cleanup stale peers every few heartbeats
      if (Math.random() < 0.2) { // 20% chance each heartbeat
        this.cleanupStalePeers();
      }
    }, this.heartbeatInterval) as unknown as number;
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

console.log("I am connectButton", connectButton);

function updateStatus(message: string): void {
  if (statusDiv) {
    statusDiv.textContent = message;
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
  console.log("hello connectbutton is clicked");
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
