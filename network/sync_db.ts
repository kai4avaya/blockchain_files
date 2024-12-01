import indexDBOverlay from "../memory/local/file_worker";
import { p2pSync } from "./peer2peer_simple";
import in_memory_store from "../memory/local/in_memory";

class DBSyncManager {
    private static instance: DBSyncManager | null = null;
    private activeSyncs: Set<string> = new Set();
    private syncTimeout: number = 5000;
    private syncInProgress: boolean = false;
    private lastSyncTimestamps: Map<string, number> = new Map();
    private isInEquilibrium: Map<string, boolean> = new Map();

    private constructor() {}

    static getInstance(): DBSyncManager {
        if (!DBSyncManager.instance) {
            DBSyncManager.instance = new DBSyncManager();
        }
        return DBSyncManager.instance;
    }

    async initiateSync(peerId: string): Promise<void> {
        if (this.activeSyncs.has(peerId) || this.isInEquilibrium.get(peerId)) {
            return;
        }

        try {
            this.activeSyncs.add(peerId);
            await this.checkAndSyncDatabases(peerId);
            
            setTimeout(() => {
                this.activeSyncs.delete(peerId);
            }, this.syncTimeout);
        } catch (error) {
            console.error('Error during sync initiation:', error);
            this.activeSyncs.delete(peerId);
        }
    }

    private async checkAndSyncDatabases(specificPeerId?: string): Promise<void> {
        if (!p2pSync.isConnected() || this.syncInProgress) return;

        try {
            this.syncInProgress = true;
            const tables = await indexDBOverlay.getAllTables();
            const manifest = await this.createDatabaseManifest(tables);
            
            const manifestObj = Object.fromEntries(manifest);
            
            const message = {
                type: 'db_sync_check',
                data: manifestObj,
                timestamp: Date.now()
            };

            if (specificPeerId) {
                p2pSync.sendCustomMessage(specificPeerId, message);
            }
        } catch (error) {
            console.error('Error during database sync check:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    async handleSyncCheck(manifestData: Record<string, any>, peerId: string, timestamp?: number): Promise<void> {
        try {
            if (this.isInEquilibrium.get(peerId)) {
                return;
            }

            const localManifest = await this.createDatabaseManifest(
                Object.keys(manifestData)
            );

            const mismatchedTables = this.findMismatchedTables(
                localManifest, 
                new Map(Object.entries(manifestData))
            );

            if (mismatchedTables.length > 0) {
                p2pSync.sendCustomMessage(peerId, {
                    type: 'db_sync_request',
                    data: mismatchedTables,
                    timestamp: Date.now()
                });
            } else {
                this.isInEquilibrium.set(peerId, true);
                console.log(`Reached equilibrium with peer ${peerId}`);
            }

            if (timestamp) {
                this.lastSyncTimestamps.set(peerId, timestamp);
            }
        } catch (error) {
            console.error('Error in handleSyncCheck:', error);
        }
    }

    private async createDatabaseManifest(tables: string[]): Promise<Map<string, any>> {
        const manifest = new Map<string, any>();

        for (const table of tables) {
            try {
                const records = await indexDBOverlay.getAll(table);
                console.log(`Creating manifest for ${table}:`, records);

                if (!Array.isArray(records) || records.length === 0) {
                    manifest.set(table, {});
                    continue;
                }

                const recordVersions = records.reduce((acc: Record<string, any>, record: any) => {
                    let recordId = record.id || record.key;
                    
                    if (table === 'graph') {
                        recordId = record.userData?.id;
                    } else if (table === 'summaries') {
                        recordId = record.fileId;
                    }

                    if (recordId) {
                        acc[recordId] = {
                            version: record.version || 0,
                            globalTimestamp: record.globalTimestamp || 0,
                            versionNonce: record.versionNonce
                        };
                    }
                    return acc;
                }, {});
                
                manifest.set(table, recordVersions);
            } catch (error) {
                console.error(`Error creating manifest for table ${table}:`, error);
                manifest.set(table, {});
            }
        }

        return manifest;
    }

    private findMismatchedTables(
        localManifest: Map<string, any>,
        peerManifest: Map<string, any>
    ): string[] {
        const mismatched: string[] = [];
        console.log('Comparing manifests:', {local: localManifest, peer: peerManifest}); // Debug log

        peerManifest.forEach((peerVersions, table) => {
            const localVersions = localManifest.get(table) || {};
            
            if (Object.keys(peerVersions).length > 0 || Object.keys(localVersions).length > 0) {
                const allRecordIds = new Set([
                    ...Object.keys(localVersions),
                    ...Object.keys(peerVersions)
                ]);

                for (const recordId of allRecordIds) {
                    const localRecord = localVersions[recordId];
                    const peerRecord = peerVersions[recordId];

                    if (!localRecord || !peerRecord || 
                        localRecord.version !== peerRecord.version ||
                        localRecord.globalTimestamp !== peerRecord.globalTimestamp ||
                        localRecord.versionNonce !== peerRecord.versionNonce) {
                        if (!mismatched.includes(table)) {
                            console.log(`Mismatch found in table ${table}:`, {
                                recordId,
                                local: localRecord,
                                peer: peerRecord
                            });
                            mismatched.push(table);
                            break;
                        }
                    }
                }
            }
        });

        console.log('Mismatched tables:', mismatched); // Debug log
        return mismatched;
    }

    async handleSyncRequest(tables: string[]): Promise<void> {
        const syncData = new Map<string, any[]>();

        for (const table of tables) {
            if (!table.includes('vectors_hashIndex')) {
                const records = await indexDBOverlay.getAll(table);
                syncData.set(table, records);
            }
        }

        p2pSync.broadcastCustomMessage({
            type: 'db_sync_response',
            data: Array.from(syncData.entries()),
            timestamp: Date.now()
        });
    }

    async handleSyncResponse(syncData: [string, any[]][], timestamp?: number): Promise<void> {
        try {
            if (timestamp && Array.from(this.lastSyncTimestamps.values()).some(t => t >= timestamp)) {
                return;
            }

            if (Array.isArray(syncData)) {
                for (const [table, records] of syncData) {
                    if (!(await indexDBOverlay.checkIfTableExists(table))) {
                        await indexDBOverlay.createTableIfNotExists(table);
                    }

                    for (const record of records) {
                        record.isFromPeer = true;
                        await indexDBOverlay.saveData(table, record, record.id || record.key);
                    }
                }
            } else {
                console.warn('Received invalid sync data format:', syncData);
            }
        } catch (error) {
            console.error('Error in handleSyncResponse:', error);
        }
    }

    resetEquilibrium(peerId: string): void {
        this.isInEquilibrium.delete(peerId);
    }
}

const dbSyncManager = DBSyncManager.getInstance();
export default dbSyncManager;
