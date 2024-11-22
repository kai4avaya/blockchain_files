// network\elections.ts

import { Peer } from "peerjs";
import indexDBOverlay from "../memory/local/file_worker";
import { messageBroker } from './message_broker';
import in_memory_store from "../memory/local/in_memory";
import {p2pSync} from './peer2peer_simple';

class P2PLeaderCoordinator {
  private static instance: P2PLeaderCoordinator | null = null;
  private peer: Peer | null = null;
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

    messageBroker.subscribe('leader_announcement', this.handleLeaderAnnouncement.bind(this));
    messageBroker.subscribe('db_sync_initial', this.handleDatabaseSync.bind(this));

    p2pSync.onPeerConnect((peerId) => {
      this.handlePeerConnection(peerId);
    });

    this.peer.on("open", (id) => {
      console.log(`Peer initialized with ID: ${id}`);
      if (!this.leaderId) {
        this.becomeLeader();
      }
    });
  }

  private becomeLeader(): void {
    if (!this.peer) return;
    this.leaderId = this.peer.id;
    this.isLeader = true;
    console.log(`I am the leader: ${this.peer.id}`);
    
    messageBroker.broadcast({
      type: "leader_announcement",
      leaderId: this.peer.id,
    });
  }

  private async handleDatabaseSyncRequest(tables: string[], peerId: string): Promise<void> {
    const syncData: Record<string, any> = {};
    
    for (const table of tables) {
      syncData[table] = await indexDBOverlay.getAll(table);
    }
    
    messageBroker.broadcast({
      type: "db_sync_initial",
      data: syncData,
      targetPeerId: peerId
    });
  }

  private handleLeaderAnnouncement(message: any, peerId: string): void {
    this.updateLeaderStatus(message.leaderId);
  }

  private async handleDatabaseSync(message: any, peerId: string): Promise<void> {
    const { tableName, data } = message.data;

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

  private handlePeerConnection(peerId: string): void {
    if (this.isLeader && this.peer) {
      messageBroker.broadcast({
        type: "leader_announcement",
        leaderId: this.peer.id,
        targetPeerId: peerId
      });
    }
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
    
    const connectedPeers = p2pSync.getConnectedPeers();
    if (!this.leaderId || !connectedPeers.includes(this.leaderId)) {
      console.warn("Leader is down. Electing a new leader...");
      this.electNewLeader();
    }
  }

  private electNewLeader(): void {
    const connectedPeers = p2pSync.getConnectedPeers();
    if (connectedPeers.length === 0) {
      this.becomeLeader();
    } else {
      const newLeader = connectedPeers[Math.floor(Math.random() * connectedPeers.length)];
      this.leaderId = newLeader;
      this.isLeader = newLeader === this.peer?.id;
      console.log(`New leader elected: ${newLeader}`);
      if (this.isLeader) {
        messageBroker.broadcast({
          type: "leader_announcement",
          leaderId: newLeader,
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
