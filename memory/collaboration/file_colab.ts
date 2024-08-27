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
  
    private async initializeDB() {
      console.log('Starting initializeDB');
      try {
        await indexDBOverlay.initializeDB(['files', 'directories']);
        console.log('indexDBOverlay initialized');
  
        const files = await indexDBOverlay.getData('files');
        console.log('Files fetched:', files);
        
        const directories = await indexDBOverlay.getData('directories');
        console.log('Directories fetched:', directories);
        
  
        console.log('Files fetched:', files);
        console.log('Directories fetched:', directories);
  
        this.snapshot = {
          files: files || [],
          directories: directories || [],
          version: 0  // Start with version 0 for a new system
        };
  
        console.log('Snapshot created:', this.snapshot);
  
        this.isReady = true;
        console.log('FileSystem is now ready');
        this.notifyReadyCallbacks();
      } catch (error) {
        console.error('Error in initializeDB:', error);
        // Even if there's an error, we should set isReady to true and notify callbacks
        this.isReady = true;
        this.notifyReadyCallbacks();
      }
    }
  
    private notifyReadyCallbacks() {
      console.log(`Notifying ${this.readyCallbacks.length} ready callbacks`);
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

  getMetadata<T extends FileMetadata | DirectoryMetadata>(id: string, type: 'file' | 'directory'): T | undefined {
    const items = type === 'file' ? this.snapshot.files : this.snapshot.directories;
    console.log("i am items in getMetaData!", items)
    return items.find(item => item.id === id) as T | undefined;
  }


  private async applyUpdate(update: Partial<FileSystemSnapshot>) {
    console.log('applyUpdate update, isReady', update, this.isReady);
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

  async addOrUpdateItem<T extends FileMetadata | DirectoryMetadata>(item: T, type: 'file' | 'directory'): Promise<void> {
    this.updateMetadata(item);
    const key = type === 'file' ? 'files' : 'directories';
    const updatedItems = [...this.snapshot[key], item];
    console.log("file colab in addOrUpdate: " + updatedItems)
    await this.applyUpdate({ [key]: updatedItems });
  }

  async deleteItem(id: string, type: 'file' | 'directory'): Promise<void> {
    const key = type === 'file' ? 'files' : 'directories';
    const item = this.snapshot[key].find(i => i.id === id);
    if (item) {
      item.isDeleted = true;
      this.updateMetadata(item);
      await this.applyUpdate({ [key]: this.snapshot[key] });
    }
  }

  async addFileToDirectory(fileId: string, directoryId: string): Promise<void> {
    const directory = this.getMetadata<DirectoryMetadata>(directoryId, 'directory');
    if (directory) {
      directory.fileIds = [...new Set([...directory.fileIds, fileId])];
      await this.addOrUpdateItem(directory, 'directory');
    }
  }

  async removeFileFromDirectory(fileId: string, directoryId: string): Promise<void> {
    const directory = this.getMetadata<DirectoryMetadata>(directoryId, 'directory');
    if (directory) {
      directory.fileIds = directory.fileIds.filter(id => id !== fileId);
      await this.addOrUpdateItem(directory, 'directory');
    }
  }
}
export const getFileSystem = FileSystem.getInstance;
export const initializeFileSystem = async () => {
  const fileSystem = FileSystem.getInstance();
  return new Promise<void>((resolve) => {
    fileSystem.onReady(() => {
      console.log('FileSystem initialized and ready');
      resolve();
    });
  });
};