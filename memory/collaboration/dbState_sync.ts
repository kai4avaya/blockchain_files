import { p2pSync } from '../../network/peer2peer_simple';
import indexDBOverlay from '../local/file_worker';
// import { generateVersionNonce } from '../../utils/utils';
import config from '../../configs/config.json';

interface DBState {
  tableName: string;
  data: any;
  version: number;
  versionNonce: number;
  lastEditedBy: string;
}

class DBSyncManager {
  private static instance: DBSyncManager | null = null;
  private p2pSync: typeof p2pSync;
//   private excludedTables: Set<string> = new Set(config.excludedSyncTables);
  private lastKnownStates: Map<string, Map<string, number>> = new Map();

  constructor() {
    this.p2pSync = p2pSync;
    this.p2pSync.setCustomMessageHandler(this.handlePeerMessage.bind(this));
  }

  static getInstance(): DBSyncManager {
    if (!DBSyncManager.instance) {
      DBSyncManager.instance = new DBSyncManager();
    }
    return DBSyncManager.instance;
  }

  private async handlePeerMessage(message: any, peerId: string) {

    console.log("incoming message from ", peerId, "message", message);
    if (message.type === 'db_sync') {
        const state: DBState = message.data;
        
        if (!config.excludedSyncTables.includes(state.tableName)) {
            const currentVersion = this.getStateVersion(state.tableName, state.data.id);
            
            if (this.isNewerState(state.version, currentVersion)) {
                await indexDBOverlay.saveData(state.tableName, state.data);
                this.updateStateVersion(state.tableName, state.data.id, state.version);
            }
        }
    }
}

  

  private isNewerState(incomingVersion: number, currentVersion: number): boolean {
    return incomingVersion > (currentVersion || 0);
  }

  private getStateVersion(tableName: string, id: string): number {
    return this.lastKnownStates.get(tableName)?.get(id) || 0;
  }

  private updateStateVersion(tableName: string, id: string, version: number) {
    if (!this.lastKnownStates.has(tableName)) {
      this.lastKnownStates.set(tableName, new Map());
    }
    this.lastKnownStates.get(tableName)?.set(id, version);
  }
}

export const dbSyncManager = DBSyncManager.getInstance();
