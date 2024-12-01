import indexDBOverlay from "../memory/local/file_worker";
import { p2pSync } from "./peer2peer_simple";
import in_memory_store from "../memory/local/in_memory";

class DBSyncManager {
    private static instance: DBSyncManager | null = null;
    private syncInterval: number = 30000; // 30 seconds
    private intervalId: NodeJS.Timeout | null = null;
    private lastSyncTimestamps: Map<string, number> = new Map();
    private activeSyncs: Set<string> = new Set(); // Track active sync operations
    private syncTimeout: number = 5000; // 5 second timeout for sync operations

    private constructor() {}

    static getInstance(): DBSyncManager {
        if (!DBSyncManager.instance) {
            DBSyncManager.instance = new DBSyncManager();
        }
        return DBSyncManager.instance;
    }

    // Initiate immediate sync with a specific peer
    async initiateSync(peerId: string): Promise<void> {
        const syncKey = `${peerId}-${Date.now()}`;
        if (this.activeSyncs.has(syncKey)) return;

        try {
            this.activeSyncs.add(syncKey);
            await this.checkAndSyncDatabases(peerId);
            
            // Set a timeout to remove the sync key
            setTimeout(() => {
                this.activeSyncs.delete(syncKey);
            }, this.syncTimeout);
        } catch (error) {
            console.error('Error during sync initiation:', error);
            this.activeSyncs.delete(syncKey);
        }
    }

    startSync(): void {
        if (this.intervalId) return;
        
        this.intervalId = setInterval(() => {
            this.checkAndSyncDatabases();
        }, this.syncInterval);
    }

    stopSync(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async checkAndSyncDatabases(specificPeerId?: string): Promise<void> {
        if (!p2pSync.isConnected()) return;

        try {
            const tables = (await indexDBOverlay.getAllTables())
            
            const manifest = await this.createDatabaseManifest(tables);
            
            const manifestObject: Record<string, number> = Object.fromEntries(
                Array.from(manifest.entries()).map(([key, value]) => [key, Number(value)])
            );
            
            const message = {
                type: 'db_sync_check',
                data: manifestObject,
                timestamp: Date.now()
            };

            if (specificPeerId) {
                p2pSync.sendCustomMessage(specificPeerId, message);
            } else {
                p2pSync.broadcastCustomMessage(message);
            }
        } catch (error) {
            console.error('Error during database sync check:', error);
        }
    }

    private async createDatabaseManifest(tables: string[]): Promise<Map<string, number>> {
        const manifest = new Map<string, number>();

        for (const table of tables) {
            const records = await indexDBOverlay.getAll(table);
            manifest.set(table, records.length);
        }

        return manifest;
    }

    async handleSyncCheck(manifestData: Record<string, number>, peerId: string, timestamp?: number): Promise<void> {
        try {
            // Convert plain object to entries array, then to Map
            const manifest = new Map(
                Object.entries(manifestData)
            );
            
            const lastSync = this.lastSyncTimestamps.get(peerId);
            if (lastSync && timestamp && lastSync >= timestamp) {
                return;
            }

            const localManifest = await this.createDatabaseManifest(
                Array.from(manifest.keys())
            );

            const mismatchedTables = this.findMismatchedTables(localManifest, manifest);

            if (mismatchedTables.length > 0) {
                p2pSync.sendCustomMessage(peerId, {
                    type: 'db_sync_request',
                    data: mismatchedTables,
                    timestamp: Date.now()
                });
            }

            if (timestamp) {
                this.lastSyncTimestamps.set(peerId, timestamp);
            }
        } catch (error) {
            console.error('Error in handleSyncCheck:', error);
        }
    }

    private findMismatchedTables(
        localManifest: Map<string, number>,
        peerManifest: Map<string, number>
    ): string[] {
        const mismatched: string[] = [];

        // Ensure we're working with Maps
        const localMap = localManifest instanceof Map ? localManifest : new Map(Object.entries(localManifest));
        const peerMap = peerManifest instanceof Map ? peerManifest : new Map(Object.entries(peerManifest));

        peerMap.forEach((count, table) => {
            const localCount = localMap.get(table);
            if (localCount === undefined || localCount !== count) {
                mismatched.push(table);
            }
        });

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
            // Skip if this is an old sync response
            if (timestamp && Array.from(this.lastSyncTimestamps.values()).some(t => t >= timestamp)) {
                return;
            }

            // Ensure syncData is an array before processing
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
}

const dbSyncManager = DBSyncManager.getInstance();
export default dbSyncManager;
