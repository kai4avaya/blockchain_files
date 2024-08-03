declare module 'indexedDBModule' {
  export interface DirectoryEntry {
    id: number;
    name: string;
    entries: DirectoryEntry[];
  }

  export interface FileMetadata {
    id?: number;
    name: string;
    type: string;
    size: number;
    lastModified: number;
    content: string;
  }

  export interface GraphData {
    id: number;
    plainData: any[];
  }

  export interface DatabaseInstance {
    transaction(storeNames: string | string[], mode?: IDBTransactionMode): IDBTransaction;
    createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
    objectStoreNames: DOMStringList;
  }

  export function openDB(): Promise<DatabaseInstance | null>;
  export function initializeDB(): Promise<void>;
  export function saveDirectoryMetadata(directory: DirectoryEntry): Promise<number>;
  export function saveFileMetadata(file: FileMetadata): Promise<number>;
  export function getFileMetadata(id: number): Promise<FileMetadata>;
  export function saveGraphData(data: any[]): Promise<number>;
  export function getGraphData(): Promise<GraphData>;

  export function saveData(storeName: string, data: any): Promise<number>;
  export function getData(storeName: string): Promise<any[]>;
}

