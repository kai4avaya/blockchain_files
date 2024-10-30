// network\yjs-peerjs-provider.ts
import * as Y from 'yjs';
// import { Awareness } from 'y-protocols/awareness'; // Add this import
import { p2pSync } from './peer2peer_simple';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';


export class YjsPeerJSProvider {
  private ydoc: Y.Doc;
  private p2pSync: typeof p2pSync;
  private docId: string;
  private awareness: Awareness; // Add this line

  constructor(ydoc: Y.Doc, p2pSync: any, docId: string, awareness: Awareness) { // Add awareness parameter
    this.ydoc = ydoc;
    this.p2pSync = p2pSync;
    this.docId = docId;
    this.awareness = awareness; // Assign awareness

    // Listen for local Yjs updates
    this.ydoc.on('update', this.handleLocalUpdate.bind(this));

    // Listen for local awareness updates
    this.awareness.on('update', this.handleAwarenessUpdate.bind(this)); // Add this line

    // Handle incoming messages
    this.p2pSync.setCustomMessageHandler(this.handlePeerMessage.bind(this));
  }

  public getDocId(): string {
    return this.docId;
  }

  private handleLocalUpdate(update: Uint8Array) {
    this.p2pSync.broadcastCustomMessage({
      type: 'yjs_update',
      docId: this.docId,
      data: Array.from(update),
    });
  }

  private handleAwarenessUpdate(
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ) {
    const changedClients = added.concat(updated, removed);
    const awarenessUpdate = encodeAwarenessUpdate(this.awareness, changedClients);

    this.p2pSync.broadcastCustomMessage({
      type: 'yjs_awareness',
      docId: this.docId,
      data: Array.from(awarenessUpdate),
    });
  }

  updateDocId(newDocId: string) {
    this.docId = newDocId;
  }

  public handlePeerMessage(message: any, peerId: string) {
    if (message.type === 'yjs_update' && message.docId === this.docId) {
      Y.applyUpdate(this.ydoc, new Uint8Array(message.data));
    } else if (message.type === 'yjs_awareness' && message.docId === this.docId) {
      applyAwarenessUpdate(this.awareness, new Uint8Array(message.data), this);
    }
    }
  }
  