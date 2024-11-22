// network\elections.ts

import { Peer, DataConnection } from "peerjs";
import indexDBOverlay from "../memory/local/file_worker";
import { p2pSync } from "./peer2peer_simple";
// import { table } from "@markdoc/markdoc/dist/src/schema";
import in_memory_store from "../memory/local/in_memory";
// import { sceneState } from "../memory/collaboration/scene_colab";

class P2PLeaderCoordinator {
  private static instance: P2PLeaderCoordinator | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private leaderId: string | null = null;
  private isLeader: boolean = false;

  private constructor() {}

  static getInstance(): P2PLeaderCoordinator {
    if (!P2PLeaderCoordinator.instance) {
      P2PLeaderCoordinator.instance = new P2PLeaderCoordinator();
    }
    return P2PLeaderCoordinator.instance;
  }

  initialize(peer: Peer): void {
    this.peer = peer;

    this.peer.on("open", (id) => {
      console.log(`Peer initialized with ID: ${id}`);
      // Automatically become leader if no leader is set
      if (!this.leaderId) {
        this.becomeLeader();
      }
    });
  }

  connectToPeer(peerId: string): void {
    if (!this.peer) return;
    const conn = this.peer.connect(peerId);

    conn.on("open", () => {
      this.connections.set(peerId, conn);
      console.log(`Connected to peer ${peerId}`);

      if (this.isLeader) {
        // Share connected peers with the new peer
        this.shareConnectedPeers(conn);
        // Initiate database synchronization
        this.syncDatabaseWithPeer(conn, peerId);
      }
    });

    conn.on("data", (data) => {
      this.handleIncomingData(data);
    });

    conn.on("close", () => {
      this.connections.delete(peerId);
      console.log(`Disconnected from peer ${peerId}`);
      if (this.isLeader) {
        this.checkLeaderStatus();
      }
    });

    conn.on("error", (error) => {
      console.error(`Connection error with peer ${peerId}:`, error);
    });
  }

  private becomeLeader(): void {
    if (!this.peer) return;
    this.leaderId = this.peer.id;
    this.isLeader = true;
    console.log(`I am the leader: ${this.peer.id}`);
    // Notify p2pSync about the leadership status
    p2pSync.broadcastCustomMessage({
      type: "leader_announcement",
      leaderId: this.leaderId,
    });
  }

  private shareConnectedPeers(conn: DataConnection): void {
    const peerIds = Array.from(this.connections.keys());
    conn.send({ type: "connected_peers", data: peerIds });
  }

  // once peer A has synced by sending all data to B, this should then trigger B to send back all data to A
  //  we might want to add a flag to ensure we dont do a double loop
  private syncDatabaseWithPeer(conn: DataConnection, peerId: string): void {
    indexDBOverlay.getAllTables().then((tables) => {
      tables.forEach(async (tableName) => {
        const data = await indexDBOverlay.getAll(tableName);
        if (tableName.includes("vectors_hashIndex")) {
          console.log("this peerid im getting is it mine?", peerId);

          tableName = `vectors_hashIndex_${p2pSync.getCurrentPeerId()}`;
          console.log("i am in elections", tableName);
        }

        // send to all peers message "db_sync_initial"
        conn.send({ type: "db_sync_initial", data: { tableName, data } });

        // Special handling for 'peers' table to connect to known peers
        if (tableName === "peers") {
          data.forEach((peer) => {
            if (
              peer.peerId !== this.peer?.id &&
              !this.connections.has(peer.peerId)
            ) {
              this.connectToPeer(peer.peerId);
            }
          });
        }
      });
    });
  }

  handleIncomingData(data: any): void {
    switch (data.type) {
      case "initial_connection":
        this.handleInitialConnection(data.data.peerId);
        break;
      case "connected_peers":
        this.connectToSharedPeers(data.data);
        break;
      case "db_sync_initial":
        console.log(
          "db_sync_initial",
          "data,data: ",
          data.data,
          "data : ",
          data,
          ``
        );
        this.handleDatabaseSync(data.data);
        break;
      case "leader_announcement":
        this.updateLeaderStatus(data.leaderId);
        break;
      case "request_leader_election":
        this.handleLeaderElectionRequest();
        break;
      default:
        console.warn(`Unknown data type received: ${data.type}`);
    }
  }

  private handleInitialConnection(peerId: string): void {
    console.log(`Handling initial connection with peer ${peerId}`);
    // Perform leader election or other initialization tasks
    if (!this.leaderId) {
      this.becomeLeader();
    } else {
      // Notify the new peer about the current leader
      const conn = this.connections.get(peerId);
      if (conn?.open) {
        conn.send({ type: "leader_announcement", leaderId: this.leaderId });
      }
    }
  }

  private connectToSharedPeers(peerIds: string[]): void {
    peerIds.forEach((peerId) => {
      if (peerId !== this.peer?.id && !this.connections.has(peerId)) {
        this.connectToPeer(peerId);
      }
    });
  }


  // this will trigger a sync with the peer that just connected
  public triggerInitialDbSync(conn: DataConnection): void {
    console.log(" triggerInitialDbSync called");
    indexDBOverlay
      .getAllTables()
      .then((tables) => {
        console.log("tables", tables);
        tables.forEach(async (tableName) => {
          let data = await indexDBOverlay.getAll(tableName);

          console.log("data from triggerInitialDbSync", data);

          // Modify tableName for `vector_hashIndex` if necessary
          if (tableName.includes("vectors_hashIndex")) {
            tableName = `vectors_hashIndex_${p2pSync.getCurrentPeerId()}`;
            console.log("tableName CHANGED vector_hashIndex_", tableName);
          }

          // Send initial database sync data
          conn.send({ type: "db_sync_initial", data: { tableName, data } });
        });
      })
      .catch((error) => {
        console.error("Error during initial DB sync:", error);
      });
  }

  public async handleDatabaseSync(syncData: {
    tableName: string;
    data: any[];
  }) {
    const { tableName, data } = syncData;

    let targetTableName = tableName;

    console.log("handleDatabaseSync called with tableName:", tableName);

    // Ensure the table exists before saving data
    if (!(await indexDBOverlay.checkIfTableExists(tableName))) {
      // await indexDBOverlay.createTableIfNotExists(tableName);
      in_memory_store.createTableIfNotExists(tableName);
      in_memory_store.saveData(tableName, data);

      return; // we break out since this will cause indexdb error
    }

    for (const item of data) {
      const existingItems = await indexDBOverlay.getAll(targetTableName);

      let itemExists = existingItems.some(
        (existingItem) => existingItem.id === item.id
      );
      if (!itemExists)
        existingItems.some((existingItem) => existingItem.key === item.key);

      if (!itemExists) {
        // Temporarily suppress broadcasting to avoid boomerang effects
        item.isFromPeer = true;
        await indexDBOverlay.saveData(
          targetTableName,
          item,
          item.id || item.key
        );
      }
    }
    // Trigger scene reconstruction after database sync
    this.triggerSceneReconstruction();
    // if(tableName === "graph") this.triggerSceneReconstruction()
  }

  private triggerSceneReconstruction() {
    setTimeout(async () => {
      // @ts-ignore
        const { reconstructFromGraphData } = await import('../ui/graph_v2/create.js');
        reconstructFromGraphData();
    }, 0);
}


  private checkLeaderStatus(): void {
    if (this.isLeader) return;
    if (!this.leaderId || !this.connections.has(this.leaderId)) {
      console.warn("Leader is down. Electing a new leader...");
      this.electNewLeader();
    }
  }

  private electNewLeader(): void {
    const peerIds = Array.from(this.connections.keys());
    if (peerIds.length === 0) {
      this.becomeLeader();
    } else {
      // Randomly select a new leader
      const newLeader = peerIds[Math.floor(Math.random() * peerIds.length)];
      this.leaderId = newLeader;
      this.isLeader = newLeader === this.peer?.id;
      console.log(`New leader elected: ${newLeader}`);
      if (this.isLeader) {
        p2pSync.broadcastCustomMessage({
          type: "leader_announcement",
          leaderId: this.leaderId,
        });
      }
    }
  }

  private updateLeaderStatus(newLeaderId: string): void {
    this.leaderId = newLeaderId;
    this.isLeader = this.leaderId === this.peer?.id;
  }

  private handleLeaderElectionRequest(): void {
    if (!this.isLeader) {
      this.electNewLeader();
    }
  }
}

const leaderCoordinator = P2PLeaderCoordinator.getInstance();
export default leaderCoordinator;
