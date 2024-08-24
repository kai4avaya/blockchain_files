import { makeObservable, observable, action, runInAction, autorun } from "mobx";
import { saveData, getData } from '../local/db.js';
// import { updateGraph, isRendererReady } from '../../ui/graph/graph.js'; // Import isRendererReady
import { updateGraph, isRendererReady } from '../../ui/graph_v2/create.js'; // Import isRendererReady

interface FileMetadata {
  id: number;
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
  content?: string;
  neighbors?: number[]; // Array of IDs of neighboring files
  tags?: string[]; // Array of tags related to the file
  edges?: number[]; // Array of IDs of connected files (edges)
}

interface DirectoryMetadata {
  id: number;
  name: string;
  fileIds: number[]; // Array of IDs of files in this directory
  tags?: string[]; // Array of tags related to the directory build by llm
  summary?: string; // Summary of the directory built by llm
}

export class FileStore {
  @observable files: FileMetadata[] = [];
  @observable directories: DirectoryMetadata[] = [];
  @observable selectedFile: FileMetadata | null = null;

  constructor() {
    makeObservable(this);
    this.loadInitialState();

    autorun(() => {
      console.log("Files updated", this.files);
      this.saveFiles();
      if (isRendererReady()) {
        this.updateGraphNodes();
      }
    });

    autorun(() => {
      console.log("Directories updated", this.directories);
      this.saveDirectories();
    });
  }

  @action.bound
  async loadInitialState() {
    const filesData = await getData('files');
    const directoriesData = await getData('directories');
    runInAction(() => {
      if (filesData) {
        this.files = filesData;
      }
      if (directoriesData) {
        this.directories = directoriesData;
      }
      if (isRendererReady()) {
        this.updateGraphNodes();
      }
    });
  }

  @action.bound
  async addFile(file: FileMetadata, directoryId: number | null = null) {
    this.files.push(file);
    await this.saveFiles();

    if (directoryId !== null) {
      const directory = this.directories.find(dir => dir.id === directoryId);
      if (directory) {
        directory.fileIds.push(file.id);
        await this.saveDirectories();
      }
    } else {
      // Add file to root directory (ID 0) if no directory is specified
      const rootDir = this.directories.find(dir => dir.id === 0);
      if (rootDir) {
        rootDir.fileIds.push(file.id);
        await this.saveDirectories();
      }
    }

    if (isRendererReady()) {
      this.updateGraphNodes();
    }
  }

  @action.bound
  async addDirectory(directory: DirectoryMetadata) {
    this.directories.push(directory);
    await this.saveDirectories();
  }

  @action.bound
  async updateFile(updatedFile: FileMetadata) {
    const index = this.files.findIndex(file => file.id === updatedFile.id);
    if (index !== -1) {
      this.files[index] = updatedFile;
      await this.saveFiles();
    }

    if (isRendererReady()) {
      this.updateGraphNodes();
    }
  }

  @action.bound
  async saveFiles() {
    await saveData('files', this.files);
  }

  @action.bound
  async saveDirectories() {
    await saveData('directories', this.directories);
  }
  @action.bound
  async selectFile(id: number) {
    const metadata: FileMetadata[] = await getData('files');
    runInAction(() => {
      this.selectedFile = metadata.find((file: FileMetadata) => file.id === id) || null;
    });
  }

  @action.bound
  async addNeighbor(fileId: number, neighborId: number) {
    const file = this.files.find(file => file.id === fileId);
    if (file) {
      file.neighbors = file.neighbors || [];
      file.neighbors.push(neighborId);
      await this.updateFile(file);
    }
  }

  @action.bound
  async addTag(fileId: number, tag: string) {
    const file = this.files.find(file => file.id === fileId);
    if (file) {
      file.tags = file.tags || [];
      file.tags.push(tag);
      await this.updateFile(file);
    }
  }

  @action.bound
  updateGraphNodes() {
    const nodes = this.files.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      z: Math.random() * 100 - 50,
      color: Math.random() * 0xffffff,
      edges: file.neighbors || []
    }));

    const links = [];
    this.files.forEach(file => {
      if (file.neighbors) {
        file.neighbors.forEach(neighborId => {
          links.push({ source: file.id, target: neighborId });
        });
      }
    });

    updateGraph(nodes, links);
  }
}

const fileStore = new FileStore();
export default fileStore;
