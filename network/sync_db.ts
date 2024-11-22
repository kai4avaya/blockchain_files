import { p2pSync } from './peer2peer_simple';
import indexDBOverlay from '../memory/local/file_worker';
import in_memory_store from '../memory/local/in_memory';
import P2PLeaderCoordinator from './elections';

interface MessageData  {
  type: string;
  data: any;
  sender?: string;
  leaderId?: string;
  checksums?: Record<string, string>;
  peerId?: string;
  topology?: any;
}

// Add vector hash interface
interface VectorHash {
  tableName: string;
  hash: string;
  timestamp: number;
}

export class P2PMessageHandler {
  private leaderCoordinator: typeof P2PLeaderCoordinator;
  private syncInProgress: boolean = false;
  private lastSyncTimestamp: Record<string, number> = {};
  private p2pSync: any;

  constructor(leaderCoordinator: typeof P2PLeaderCoordinator) {
    this.leaderCoordinator = leaderCoordinator;
    this.p2pSync = p2pSync;
  }

  public async handleMessage(message: MessageData, peerId: string): Promise<void> {
    if (!peerId) {
      console.warn('Invalid peer ID received');
      return;
    }

    try {
      switch (message.type) {
        case "db_sync_initial":
          await this.handleInitialDbSync(message.data, peerId);
          break;
        case "db_verify":
          await this.handleDbVerification(message.data, peerId);
          break;
        case "db_sync_complete":
          await this.handleDbSyncComplete(peerId);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private async handleInitialDbSync(data: any, peerId: string): Promise<void> {
    console.log(`Receiving initial DB sync from ${peerId}`);
    try {
      const { vectorHashes, tableData } = this.separateVectorHashes(data);
      
      if (vectorHashes.length > 0) {
        await in_memory_store.route('save data', 'vectors_hashIndex', {
          hashes: vectorHashes,
          timestamp: Date.now()
        });
      }

      await this.verifyAndApplyDbChanges(tableData);
      this.broadcastSyncStatus(peerId, vectorHashes);
      await this.verifyNetworkConsistency();
    } catch (error: any) {
      console.error("Error during DB sync:", error);
      this.p2pSync.broadcastCustomMessage({
        type: "db_verify",
        data: { status: "error", message: error.message, peerId }
      });
    }
  }

  private separateVectorHashes(data: any): { vectorHashes: VectorHash[], tableData: any } {
    const vectorHashes: VectorHash[] = [];
    const tableData: any = {};

    for (const [tableName, tableContent] of Object.entries(data)) {
      if (tableName.includes('vectors_hashIndex')) {
        vectorHashes.push({
          tableName,
          hash: (tableContent as any).hash,
          timestamp: Date.now()
        });
      } else {
        tableData[tableName] = tableContent;
      }
    }

    return { vectorHashes, tableData };
  }

  private async handleDbVerification(data: any, peerId: string): Promise<void> {
    console.log(`Received DB verification from ${peerId}:`, data);
    if (data.status === "success") {
      await this.handleDbSyncComplete(peerId);
    } else {
      console.error(`DB verification failed for peer ${peerId}:`, data.message);
      // Trigger re-sync if needed
      await this.syncDatabaseWithLeader(peerId);
    }
  }

  private async handleDbSyncComplete(peerId: string): Promise<void> {
    console.log(`DB sync completed with peer ${peerId}`);
    // Update peer status
    await indexDBOverlay.saveData('peers', {
      peerId,
      status: 'connected',
      lastSync: Date.now()
    });
  }

  private async syncDatabaseWithLeader(leaderId: string): Promise<void> {
    // Request full database sync from leader
    this.p2pSync.sendToPeer(leaderId, {
      type: "db_sync_initial",
      data: { requestId: Date.now() }
    });
  }

  private async broadcastSyncStatus(sourcePeerId: string, vectorHashes: VectorHash[]): Promise<void> {
    const message = {
      type: "db_sync_status",
      data: {
        sourcePeerId,
        vectorHashes,
        timestamp: Date.now()
      }
    };
    this.p2pSync.broadcastCustomMessage(message);
  }

  public async verifyNetworkConsistency(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const tables = await indexDBOverlay.getAllTables();
      const checksums: Record<string, string> = {};

      // Generate checksums for each table sequentially
      for (const table of tables) {
        const data = await indexDBOverlay.getAll(table);
        checksums[table] = await this.generateTableChecksum(data);
      }

      // Broadcast checksums to all peers
      this.p2pSync.broadcastCustomMessage({
        type: "db_verify_checksums",
        data: {
          checksums,
          timestamp: Date.now()
        }
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  private async generateTableChecksum(data: any[]): Promise<string> {
    // Sort data to ensure consistent ordering
    const sortedData = data.sort((a, b) => {
      const idA = a.id || a.key;
      const idB = b.id || b.key;
      return idA.localeCompare(idB);
    });
    
    // Create a string representation and hash it
    const dataString = JSON.stringify(sortedData);

    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataString))
      .then(hash => Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      );
  }

  public async handleChecksumVerification(message: any, peerId: string): Promise<void> {
    const { checksums, timestamp } = message.data;
    
    if (this.lastSyncTimestamp[peerId] && this.lastSyncTimestamp[peerId] >= timestamp) {
      return;
    }
    
    this.lastSyncTimestamp[peerId] = timestamp;

    const localChecksums = await this.generateLocalChecksums();
    const mismatches = this.findChecksumMismatches(localChecksums, checksums);

    if (mismatches.length > 0) {
      this.p2pSync.broadcastCustomMessage({
        type: "db_sync_request",
        data: {
          tables: mismatches,
          timestamp,
          peerId
        }
      });
    }
  }

  private async generateLocalChecksums(): Promise<Record<string, string>> {
    const tables = await indexDBOverlay.getAllTables();
    const checksums: Record<string, string> = {};

    // Generate checksums for each table sequentially
    for (const table of tables) {
      const data = await indexDBOverlay.getAll(table);
      checksums[table] = await this.generateTableChecksum(data);
    }

    return checksums;
  }

  private findChecksumMismatches(
    local: Record<string, string>,
    remote: Record<string, string>
  ): string[] {
    const mismatches: string[] = [];
    
    // Check all tables in both local and remote
    const allTables = new Set([...Object.keys(local), ...Object.keys(remote)]);
    
    for (const table of allTables) {
      if (local[table] !== remote[table]) {
        mismatches.push(table);
      }
    }

    return mismatches;
  }

  private async verifyAndApplyDbChanges(tableData: any): Promise<void> {
    for (const [tableName, data] of Object.entries(tableData)) {
      try {
        // Ensure table exists
        if (!(await indexDBOverlay.checkIfTableExists(tableName))) {
          await in_memory_store.createTableIfNotExists(tableName);
        }

        // Apply changes
        const dataArray = Array.isArray(data) ? data : [data];
        for (const item of dataArray) {
          const existingItems = await indexDBOverlay.getAll(tableName);
          const itemExists = existingItems.some(
            (existing) => existing.id === item.id || existing.key === item.key
          );

          if (!itemExists) {
            item.isFromPeer = true;
            await indexDBOverlay.saveData(
              tableName,
              item,
              item.id || item.key
            );
          }
        }
      } catch (error) {
        console.error(`Error applying changes to table ${tableName}:`, error);
        throw error;
      }
    }
  }
}

// Create and export singleton instance
const messageHandler = new P2PMessageHandler(P2PLeaderCoordinator);
export default messageHandler; 