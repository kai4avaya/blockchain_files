import { Loro, LoroMap } from 'loro-crdt';
import { saveData, getData } from '../local/dbgeneral';
import { fetchGraphDataFromServer, sendGraphDataToServer } from '../../services/graphqlLayer';
// import { createSceneSnapshot } from '../../ui/graph_v2/snapshot';
import graphStore from '../stores/graphStore';
import * as THREE from "three";
import {deserialize, serialize} from "../../utils/utils";



interface Snapshot {
  objects: {
      id: string;
      object: THREE.Object3D;
      type: string;
      scene: number;
  }[];
  boxes: {
      id: string;
      wireframe: THREE.LineSegments | null;
      solid: THREE.Mesh | null;
  }[];
  containment: {
      [key: string]: string[];
  };
  debugObjects: THREE.Group;
}
// Retrieve from local storage
const loginName: string = localStorage.getItem("login_block") || "no_login";
let numericalLoginName = loginName.split('').reduce((sum, char) => {
  const charCode = char.charCodeAt(0);
  return sum * 256 + charCode;
}, 0);

const maxInt = Number.MAX_SAFE_INTEGER;
if (numericalLoginName > maxInt) {
  numericalLoginName = numericalLoginName % maxInt;
}
interface SceneData {
  snapshot: Snapshot;
  version: number;
}

class LoroCRDTManager {
  private loro: Loro;
  private sceneMap: LoroMap;

  constructor() {
    this.loro = new Loro();
    this.loro.setPeerId(numericalLoginName);
    this.sceneMap = this.loro.getMap("map");
    this.initializeLoroListeners();
  }

  private initializeLoroListeners() {
    this.sceneMap.subscribe((event) => {
      console.log("I AM da event" , event);
      if (event?.action === 'create' || event?.action === 'move') {
        this.handleLoroUpdate();
      }
    });
  }
  async initialize(): Promise<SceneData | null> {
    try {
      const serverData = await fetchGraphDataFromServer();
      if (serverData) {
        this.updateFromServerData(serverData);
        return serverData;
      }
    } catch (error) {
      console.warn("Failed to fetch data from server, loading from IndexedDB", error);
    }
  
    try {
      const localData = await getData('graph');
      if (localData) {
        const deserializedData = deserialize(localData);
        this.updateFromLocalData(deserializedData);
        return deserializedData;
      }
    } catch (error) {
      console.warn("Failed to load data from IndexedDB", error);
    }
  
    return null;
  }

  private updateFromServerData(data: SceneData) {
    this.sceneMap.set("data", JSON.stringify(data));
  }

  private updateFromLocalData(data: SceneData) {
    this.updateFromServerData(data);
  }

  updateScene(sceneData: SceneData) {
    const currentData: SceneData | null = JSON.parse(this.sceneMap.get("data") || "null");

    if (!currentData || sceneData.version > currentData.version) {
      this.sceneMap.set("data", JSON.stringify(sceneData));
      this.saveToIndexedDB(sceneData);
      this.sendToServer(sceneData);
    }
  }

  private async saveToIndexedDB(sceneData: SceneData, dbName="graph") {
    const serializedData = serialize(sceneData);
    await saveData(dbName, serializedData);
  }
  
  private async sendToServer(sceneData: SceneData) {
    try {
      await sendGraphDataToServer(sceneData);
    } catch (error) {
      console.error("Failed to send data to server", error);
    }
  }

  private handleLoroUpdate() {
    const updatedData: SceneData | null = JSON.parse(this.sceneMap.get("data") || "null");
  
    if (updatedData) {
      const deserializedData = this.deserialize(updatedData);
      graphStore.applyUpdatedData(deserializedData);
    }
  }
  

  exportChanges(): Uint8Array {
    return this.loro.exportFrom();
  }

  importChanges(bytes: Uint8Array) {
    this.loro.import(bytes);
    this.handleLoroUpdate();
  }
}

export const loroCRDTManager = new LoroCRDTManager();
export default loroCRDTManager;