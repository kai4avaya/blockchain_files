// memory\collaboration\file_colab.ts

import indexDBOverlay from '../local/file_worker';

interface BaseMetadata {
  id: string;
  name: string;
  lastModified: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  tags?: string[];
}

interface FileMetadata extends BaseMetadata {
  size: number;
  type?: string;
  content?: string;
  neighbors?: string[];
}

interface DirectoryMetadata extends BaseMetadata {
  fileIds: string[];
  summary?: string;
}

interface FileSystemSnapshot {
  files: FileMetadata[];
  directories: DirectoryMetadata[];
  version: number;
}
class FileSystem {
    private static instance: FileSystem | null = null;
    private snapshot: FileSystemSnapshot;
    private isReady: boolean = false;
    private readyCallbacks: (() => void)[] = [];
  
    private constructor() {
      this.snapshot = { files: [], directories: [], version: 0 };
      this.initializeDB();
    }
  
    public static getInstance(): FileSystem {
      if (!FileSystem.instance) {
        FileSystem.instance = new FileSystem();
      }
      return FileSystem.instance;
    }
    async getItem<T extends FileMetadata | DirectoryMetadata>(id: string, type: 'file' | 'directory'): Promise<T | undefined> {
      const storeName = type === 'file' ? 'files' : 'directories';
      const item = await indexDBOverlay.getItem(storeName, id);
      return item as T | undefined;
    }
    private async initializeDB() {
      try {
        await indexDBOverlay.initializeDB(['files', 'directories']);
  
        const files = await indexDBOverlay.getData('files');
        
        const directories = await indexDBOverlay.getData('directories');
        
        this.snapshot = {
          files: files || [],
          directories: directories || [],
          version: 0  // Start with version 0 for a new system
        };
        this.isReady = true;
        this.notifyReadyCallbacks();
      } catch (error) {
        console.error('Error in initializeDB:', error);
        // Even if there's an error, we should set isReady to true and notify callbacks
        this.isReady = true;
        this.notifyReadyCallbacks();
      }
    }
  
    private notifyReadyCallbacks() {
      this.readyCallbacks.forEach(callback => callback());
      this.readyCallbacks = [];
    }
  
    onReady(callback: () => void) {
      if (this.isReady) {
        console.log('FileSystem already ready, executing callback immediately');
        callback();
      } else {
        console.log('FileSystem not ready, queueing callback');
        this.readyCallbacks.push(callback);
      }
    }
  
  getSnapshot(): FileSystemSnapshot {
    return { ...this.snapshot };
  }



  private async applyUpdate(update: Partial<FileSystemSnapshot>) {

    if (!this.isReady) {
      await new Promise<void>(resolve => this.onReady(resolve));
    }

    if (update.files) {
      this.snapshot.files = this.mergeItems(this.snapshot.files, update.files);
      await indexDBOverlay.saveData('files', this.snapshot.files);
    }
    if (update.directories) {
      this.snapshot.directories = this.mergeItems(this.snapshot.directories, update.directories);
      await indexDBOverlay.saveData('directories', this.snapshot.directories);
    }
    this.snapshot.version++;
  }

  private mergeItems<T extends BaseMetadata>(existing: T[], incoming: T[]): T[] {
    const merged = new Map(existing.map(item => [item.id, item]));
    
    incoming.forEach(item => {
      const existingItem = merged.get(item.id);
      if (!existingItem || this.shouldUpdate(existingItem, item)) {
        merged.set(item.id, item);
      }
    });

    return Array.from(merged.values()).filter(item => !item.isDeleted);
  }

  private shouldUpdate(existing: BaseMetadata, incoming: BaseMetadata): boolean {
    return incoming.version > existing.version || 
           (incoming.version === existing.version && incoming.versionNonce < existing.versionNonce);
  }

  private updateMetadata<T extends BaseMetadata>(item: T): T {
    item.lastModified = Date.now();
    item.version = (item.version || 0) + 1;
    item.versionNonce = Math.floor(Math.random() * 1000000);
    return item;
  }
  async getMetadata<T extends FileMetadata | DirectoryMetadata>(id: string, type: 'file' | 'directory'): Promise<T | undefined> {
    // First, try to get the item from the snapshot
    const items = type === 'file' ? this.snapshot.files : this.snapshot.directories;
    let item = items.find(item => item.id === id && !item.isDeleted) as T | undefined;
  
    // If not found in snapshot, try to get from IndexedDB
    if (!item) {
      item = await this.getItem<T>(id, type);
      // Only add to snapshot if item exists and isn't deleted
      if (item && !item.isDeleted) {
        if (type === 'file') {
          (this.snapshot.files as T[]).push(item);
        } else {
          (this.snapshot.directories as T[]).push(item);
        }
      }
    }
  
    // Don't return deleted items
    return item && !item.isDeleted ? item : undefined;
  }

  async addOrUpdateItem<T extends FileMetadata | DirectoryMetadata>(item: T, type: 'file' | 'directory'): Promise<void> {
    this.updateMetadata(item);
    const key = type === 'file' ? 'files' : 'directories';
    const updatedItems = [...this.snapshot[key], item];
    await this.applyUpdate({ [key]: updatedItems });
  }

  public async refreshSnapshot(): Promise<void> {
    try {
        const files = await indexDBOverlay.getData('files');
        const directories = await indexDBOverlay.getData('directories');
      
        this.snapshot = {
            files: files || [],
            directories: directories || [],
            version: this.snapshot.version + 1
        };
        
        console.log('FileSystem snapshot refreshed:', {
            filesCount: files?.length,
            directoriesCount: directories?.length
        });
    } catch (error) {
        console.error('Error refreshing filesystem snapshot:', error);
    }
}


async  deleteItem(id: string, type: 'file' | 'directory', isJustFolder: boolean = false): Promise<void> {
  const key = type === 'file' ? 'files' : 'directories';
  const item = this.snapshot[key].find(i => i.id === id);
  if (item) {
    item.isDeleted = true;
    this.updateMetadata(item);
    
    // Remove the item from the snapshot array
    this.snapshot[key] = this.snapshot[key].filter(i => i.id !== id) as any;
    await this.applyUpdate({ [key]: this.snapshot[key] });
    
  
    // If deleting a directory, also delete all contained files
    if (type === 'directory' && 'fileIds' in item && !isJustFolder) {
      for (const fileId of item.fileIds) {
        await this.deleteItem(fileId, 'file');
      }
    }
    
    // Trigger file tree update
    window.dispatchEvent(new CustomEvent('updateFileTree'));

    console.log("deleting item from indexDB", key, id)
    
    // await indexDBOverlay.deleteItem(key, id);
    await indexDBOverlay.deleteItem_field(key, id);
  }
}

  async addFileToDirectory(fileId: string, directoryId: string): Promise<void> {
    const directory = await this.getMetadata<DirectoryMetadata>(directoryId, 'directory');
    if (directory) {
      directory.fileIds = [...new Set([...directory.fileIds, fileId])];
      await this.addOrUpdateItem(directory, 'directory');
    }
  }
  async removeFileFromDirectory(fileId: string, directoryId: string): Promise<void> {
    const directory = await this.getMetadata<DirectoryMetadata>(directoryId, 'directory');
    if (directory) {
      directory.fileIds = directory.fileIds.filter(id => id !== fileId);
      await this.addOrUpdateItem(directory, 'directory');
    }
  }}
export const getFileSystem = FileSystem.getInstance;
export const initializeFileSystem = async () => {
  const fileSystem = FileSystem.getInstance();
  return new Promise<void>((resolve) => {
    fileSystem.onReady(() => {
      resolve();
    });
  });
};